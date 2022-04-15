import Emittery from 'emittery';
import { AsyncLocalStorage } from 'node:async_hooks';
import { WriteStream } from 'node:fs';
import { WriteStream as TtyWriteStream } from 'node:tty';
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

export type LoggerProcessor<T, R = Partial<T>> =
  | ((this: Logger, log: T) => R)
  | ((this: Logger, log: T) => Promise<R>);
// | ((log: T) => Readable)
// | ((log: T) => Generator<T, R, unknown>);

export type PlainProcessor<T, R = Partial<T>> =
  | ((log: T) => R)
  | ((log: T) => Promise<R>);
// | ((log: T) => Readable)
// | ((log: T) => Generator<T, R, unknown>);

export type Processor<T = LogDescriptor, R = Partial<T>> =
  | LoggerProcessor<T, R>
  | PlainProcessor<T, R>;

export type PlainTransformer = PlainProcessor<LogDescriptor, unknown>;
export type LoggerTransformer = LoggerProcessor<LogDescriptor, unknown>;
export type Transformer = PlainTransformer | LoggerTransformer;

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

function stringifyIfNotUndefined(val: unknown): string | undefined {
  return typeof val !== 'undefined' ? String(val) : val;
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

/**
 * Arguments are all set to unknown as we really cant trust the user
 */
function toLogDescriptor(
  level: Level,
  arg1: unknown,
  arg2?: unknown,
  ...args: unknown[]
): LogDescriptor {
  const time = new Date();

  if (arg1 instanceof Error) {
    return {
      time,
      level,
      msg: typeof arg2 === 'string' ? arg2 : arg1.message,
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
      msg: format(String(arg1), [arg2, ...args], {
        stringify: safeStringify,
      }),
    };
  }

  if (Array.isArray(arg1)) {
    return {
      time,
      level,
      msg:
        typeof arg2 === 'string'
          ? format(arg2, args, {
              stringify: safeStringify,
            })
          : stringifyIfNotUndefined(arg2),
      data: { ...arg1 },
    };
  }

  if (arg1 && typeof arg1 === 'object') {
    const { err, ...data } = arg1 as JsonObjectExtendedWithError;

    if (err instanceof Error) {
      return {
        time,
        level,
        msg: typeof arg2 === 'string' ? arg2 : err.message || undefined,
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
        typeof arg2 === 'string'
          ? format(String(arg2), args, {
              stringify: safeStringify,
            })
          : stringifyIfNotUndefined(arg2),
      data: arg1,
    };
  }

  return {
    time,
    level,
    msg:
      typeof arg2 === 'string'
        ? format(arg2, args, {
            stringify: safeStringify,
          })
        : stringifyIfNotUndefined(arg1),
  };
}

const pipeCleaner = Symbol('pipe-cleaner');

export class Logger implements LogMethods {
  #inputStream = new PassThrough({
    objectMode: true,
    autoDestroy: true,
  });

  public readonly als: AsyncLocalStorage<AlsContext>;

  public level: Level;

  public destination: Writable | WriteStream | TtyWriteStream;

  #emitter = new Emittery<{
    log: LogDescriptor;
    error: unknown;
    flush: undefined;
  }>();

  #processorChain: Chain;

  #context: LogData | undefined;

  public setLevel(level: Level) {
    this.level = level;
  }

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

    const processorWrapper = (
      processor: Processor<LogDescriptor | Symbol> | Transformer,
    ): Processor<LogDescriptor | Symbol> | Transformer => {
      if (typeof processor === 'function') {
        return async (log: LogDescriptor | Symbol) => {
          // run the processor on anything log descriptory
          if (isLogDescriptor(log)) {
            try {
              return processor.call(this, log);
            } catch (err) {
              this.#emitter.emit('error', err);
              return log;
            }
          }
          // pass the pipe cleaner (or any symbol) straight through
          return log;
        };
      }

      return processor;
    };

    this.#processorChain = Chain.chain([
      ...[
        asyncLocalStorageProcessor,
        ...processors,
        ...(transformer ? [transformer.bind(this)] : []),
      ].map((processor) => processorWrapper(processor)),
    ]);

    this.destination = destination;

    this.destination.on('error', (err) => this.#emitter.emit('error', err));

    const pipeline = this.#inputStream.pipe(this.#processorChain).pipe(
      // ignore the pipe cleaner
      Chain.chain([(obj) => (obj === pipeCleaner ? null : obj)]),
    );

    if (this.destination.writable) {
      pipeline.pipe(this.destination);
    } else {
      this.#emitter.emit('error', new Error('Destination is not writeable'));
    }

    this.destination.on('end', () => {
      pipeline.unpipe(this.destination);
    });

    pipeline.on('error', (err) => this.#emitter.emit('error', err));
  }

  #write(
    level: Level,
    arg1: unknown,
    arg2?: unknown,
    ...args: unknown[]
  ): void {
    const log = Object.freeze(
      withNullProto(toLogDescriptor(level, arg1, arg2, ...args), {
        ...(this.#context && { ctx: this.#context }),
      }),
    );

    if (log.level >= this.level) {
      if (this.#inputStream.writable) {
        this.#inputStream.write(log, (writeErr: Error | null | undefined) => {
          if (writeErr) {
            this.#emitter.emit('error', writeErr);
          } else {
            // no await here
            this.#emitter
              .emit('log', log)
              .catch((err) => this.#emitter.emit('error', err));
          }
        });
      } else {
        this.#emitter
          .emit('error', new Error('Input stream is not writeable'))
          .catch(() => {});
      }
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
    this.#write(Level.Trace, ...args);
  }

  public debug(...args: any[]) {
    // @ts-expect-error
    this.#write(Level.Debug, ...args);
  }

  public warn(...args: any[]) {
    // @ts-expect-error
    this.#write(Level.Warn, ...args);
  }

  public info(...args: any[]) {
    // @ts-expect-error
    this.#write(Level.Info, ...args);
  }

  public error(...args: any[]) {
    // @ts-expect-error
    this.#write(Level.Error, ...args);
  }

  public fatal(...args: any[]) {
    // @ts-expect-error
    this.#write(Level.Fatal, ...args);
  }

  public async flush() {
    await new Promise<void>((resolve, reject) => {
      let t: NodeJS.Timeout | undefined;

      const detectPipeCleaner = (obj: LogDescriptor | Symbol) => {
        if (obj === pipeCleaner) {
          this.#processorChain.off('data', detectPipeCleaner);
          this.#processorChain.off('error', reject);
          if (t) {
            clearTimeout(t);
          }

          resolve();
        }
      };

      this.#processorChain.on('data', detectPipeCleaner);
      this.#processorChain.once('error', reject);

      // timeout waiting for the pipe cleaner
      // t = setTimeout(
      //   () =>
      //     reject(new Error('Timed out waiting for input stream to flush')),
      //   2000,
      // );

      if (this.#inputStream.writable) {
        this.#inputStream.write(pipeCleaner);
      } else {
        // reject(new Error('Stream was not writeable'));
        resolve();
      }
    }).catch((err) => this.#emitter.emit('error', err));

    await this.#emitter
      .emit('flush')
      .catch((err) => this.#emitter.emit('error', err));
  }

  public async end() {
    await this.flush();
    this.#inputStream.end();
    await finished(this.destination);
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
