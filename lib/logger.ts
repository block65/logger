import Emittery from 'emittery';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PassThrough, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import format from 'quick-format-unescaped';
import { ErrorObject, serializeError } from 'serialize-error';
import Chain from 'stream-chain';
import type { JsonPrimitive, JsonValue } from 'type-fest';
import { asyncLocalStorageProcessor } from './processors/als.js';
import { isPlainObject, safeStringify } from './utils.js';

// we support an extended set of values, as each have a toJSON method and
// corresponding representation, typically a string
type JsonValueExtended =
  | JsonObjectExtended
  | JsonArrayExtended
  | JsonPrimitive
  | Date
  | URL;

type JsonObjectExtended = { [Key in string]?: JsonValueExtended };
type JsonArrayExtended = JsonValueExtended[];

type JsonObjectExtendedWithError = JsonObjectExtended & {
  err?: Error | unknown;
};

interface LoggerOptions {
  destination: Writable;
  level?: Level;
  processors?: Processor[];
  transformer?: Transformer;
  context?: LogDescriptor['ctx'];
}

export type Processor<T = LogDescriptor, R = Partial<T>> =
  | ((log: T) => R)
  | ((log: T) => Promise<R>);
// | ((log: T) => Readable)
// | ((log: T) => Generator<T, R, unknown>);

export type Transformer = Processor<LogDescriptor, unknown>;

export enum Level {
  Silent = 0,
  Trace = 10,
  Debug = 20,
  Info = 30,
  Warn = 40,
  Error = 50,
  Fatal = 60,
}

export type LevelAsString = Lowercase<keyof typeof Level>;

export interface CreateLoggerOptions {
  destination?: Writable;
  level?: Level;
  processors?: Processor[];
  transformer?: Transformer;
  context?: LogDescriptor['ctx'];
}

export type LogData = {
  [key in string]?: JsonValueExtended | undefined | unknown;
} & {
  err?: ErrorObject;
};

export interface LogDescriptor {
  time: Date;
  level: Level;
  msg?: JsonPrimitive;
  ctx?: LogData;
  data?: LogData;
  err?: Error | unknown;
}

export interface LogMethod {
  (err: Error | unknown, str?: JsonPrimitive, ...args: JsonValue[]): void;
  (
    data: JsonObjectExtendedWithError,
    str?: JsonPrimitive,
    ...args: JsonValue[]
  ): void;
  (str: JsonPrimitive): void;
}

export interface LogMethods {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}

export interface AlsContext {
  id: string;
  context?: JsonObjectExtended;
}

function withNullProto<T extends object>(obj: T, ...objs: Partial<T>[]): T {
  return Object.assign(Object.create(null), obj, ...objs);
}

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    (typeof value !== 'undefined' &&
      typeof value !== 'object' &&
      typeof value !== 'function') ||
    value === null
  );
}

function isLogDescriptor(log: LogDescriptor | Symbol): log is LogDescriptor {
  return isPlainObject(log);
}

function toLogDescriptor(
  level: Level,
  arg1:
    | Error
    | JsonObjectExtended
    | JsonObjectExtendedWithError
    | JsonPrimitive,
  arg2?: JsonPrimitive,
  ...args: JsonPrimitive[]
): LogDescriptor {
  const time = new Date();

  if (arg1 instanceof Error) {
    return {
      time,
      level,
      msg: arg2 ? arg2.toLocaleString() : arg1.message,
      data: {
        err: serializeError(arg1),
      },
      err: arg1,
    };
  }

  if (isPrimitive(arg1)) {
    return {
      time,
      level,
      msg:
        arg1 &&
        format(arg1.toLocaleString(), [arg2, ...args], {
          stringify: safeStringify,
        }),
    };
  }

  const { err, ...data } = arg1;

  if (err instanceof Error) {
    return {
      time,
      level,
      msg: arg2
        ? arg2.toLocaleString()
        : err.message || data.message?.toLocaleString() || undefined,
      err,
      data: withNullProto({
        err: serializeError(err),
        ...data,
      }),
    };
  }

  return {
    time,
    level,
    msg:
      arg2 && format(arg2.toLocaleString(), args, { stringify: safeStringify }),
    data: data && withNullProto(data),
  };
}

const pipeCleaner = Symbol('pipe-cleaner');

export class Logger implements LogMethods {
  #inputStream = new PassThrough({
    objectMode: true,
    autoDestroy: true,
  });

  public readonly als: AsyncLocalStorage<AlsContext>;

  public readonly level: Level;

  #emitter = new Emittery<{
    log: LogDescriptor;
    error: unknown;
    flush: undefined;
  }>();

  #processorChain: Chain;

  #destination: Writable;

  #context: LogData | undefined;

  /**
   *
   * @param options {LoggerOptions}
   */
  constructor(options: LoggerOptions) {
    const {
      level = Level.Info,
      transformer,
      processors = [],
      destination,
      context,
    } = options;

    this.als = new AsyncLocalStorage<AlsContext>();

    this.#context = context && withNullProto(context);

    this.level = level;

    // TODO: validate decorators here
    // validate transformer also

    function processorWrapper(
      processor: Processor<LogDescriptor | Symbol> | Transformer,
    ): Processor<LogDescriptor | Symbol> | Transformer {
      if (typeof processor === 'function') {
        return async function ignorePipeCleaner(log: LogDescriptor | Symbol) {
          // run the processor on anything log descriptory
          if (isLogDescriptor(log)) {
            return processor(log);
          }
          // pass the pipe cleaner (or any symbol) straight through
          return log;
        };
      }

      return processor;
    }

    this.#processorChain = Chain.chain([
      ...[
        asyncLocalStorageProcessor,
        ...processors,
        ...(transformer ? [transformer] : []),
      ].map((processor) => processorWrapper(processor.bind(this))),
    ]);

    this.#destination = destination;

    this.#inputStream
      .pipe(this.#processorChain)
      .pipe(
        // ignore the pipe cleaner
        Chain.chain([(obj) => (obj === pipeCleaner ? null : obj)]),
      )
      .pipe(this.#destination);
  }

  #log(
    level: Level,
    arg1:
      | Error
      | JsonObjectExtended
      | JsonObjectExtendedWithError
      | JsonPrimitive,
    arg2?: JsonPrimitive,
    ...args: JsonPrimitive[]
  ): void {
    const log = Object.freeze(
      withNullProto(toLogDescriptor(level, arg1, arg2, ...args), {
        ...(this.#context && { ctx: this.#context }),
      }),
    );

    // no await
    this.#emitter
      .emit('log', log)
      .catch((err) => this.#emitter.emit('error', err));

    if (log.level >= this.level) {
      this.#inputStream.write(log, (err: Error | null | undefined) => {
        if (err) {
          this.#emitter.emit('error', err);
        }
      });
    }
  }

  public child(
    data: JsonObjectExtended,
    options: Pick<LoggerOptions, 'level' | 'context' | 'processors'> = {},
  ) {
    return new Logger({
      level: this.level,
      destination: this.#inputStream,
      processors: [
        function childLoggerProcessor(log) {
          return {
            ...log,
            data: {
              ...log.data,
              ...data,
            },
          };
        },
        ...(options.processors || []),
      ],
      ...options,
    });
  }

  public trace(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Trace, ...args);
  }

  public debug(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Debug, ...args);
  }

  public warn(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Warn, ...args);
  }

  public info(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Info, ...args);
  }

  public error(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Error, ...args);
  }

  public fatal(...args: any[]) {
    // @ts-expect-error
    this.#log(Level.Fatal, ...args);
  }

  public async flush() {
    this.#inputStream.write(pipeCleaner);

    await new Promise<void>((resolve, reject) => {
      let t: NodeJS.Timeout | undefined;

      const stream = this.#processorChain;

      const detectPipeCleaner = (obj: LogDescriptor | Symbol) => {
        if (obj === pipeCleaner) {
          stream.removeListener('data', detectPipeCleaner);
          stream.removeListener('error', reject);
          if (t) {
            clearTimeout(t);
          }

          resolve();
        }
      };

      stream.once('error', reject);
      stream.addListener('data', detectPipeCleaner);

      t = setTimeout(() => detectPipeCleaner(pipeCleaner), 2000);
    }).catch((err) => this.#emitter.emit('error', err));

    await this.#emitter
      .emit('flush')
      .catch((err) => this.#emitter.emit('error', err));
  }

  public async end() {
    await this.flush();
    if (!this.#inputStream.writableEnded) {
      this.#inputStream.end();
    }
    if (!this.#destination.writableFinished) {
      await finished(this.#destination);
    }
  }

  public on<Name extends 'log' | 'error' | 'flush'>(
    event: Name | Name[],
    fn: (
      eventData: { log: LogDescriptor; error: unknown; flush: undefined }[Name],
    ) => void | Promise<void>,
  ): Emittery.UnsubscribeFn {
    return this.#emitter.on(event, fn);
  }

  public off<Name extends 'log' | 'error' | 'flush'>(
    event: Name | Name[],
    fn: (
      eventData: { log: LogDescriptor; error: unknown; flush: undefined }[Name],
    ) => void | Promise<void>,
  ): void {
    return this.#emitter.off(event, fn);
  }
}
