import Emittery from 'emittery';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PassThrough, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { format } from 'node:util';
import Chain from 'stream-chain';
import type { JsonObject, JsonPrimitive, JsonValue } from 'type-fest';
import { callerProcessor } from './processors/caller.js';
import { errorProcessor } from './processors/error.js';
import { jsonTransformer } from './transformers/json.js';
import { isPlainObject } from './utils.js';

export type Processor<T = LogDescriptor, R = T> =
  | ((log: T) => R)
  | ((log: T) => Promise<R>);
// | ((log: T) => Readable)
// | ((log: T) => Generator<T, R, unknown>);

export type Transformer = Processor<LogDescriptor, unknown>;

export interface CreateLoggerOptions {
  destination?: Writable;
  level?: Level;
  processors?: Processor[];
  transformer?: Transformer;
  context?: LogDescriptor['ctx'];
}

interface LoggerOptions {
  destination: Writable;
  level?: Level;
  processors?: Processor[];
  transformer?: Transformer;
  context?: LogDescriptor['ctx'];
}

export enum Level {
  Silent = 0,
  Trace = 10,
  Debug = 20,
  Info = 30,
  Warn = 40,
  Error = 50,
  Fatal = 60,
}

type LogValue = JsonValue | undefined | Error;
type LogData = { [Key in string]?: LogValue } | Error;

export interface LogDescriptor {
  time: Date;
  level: Level;
  msg?: string;
  ctx?: JsonObject;
  data?: LogData | Error;
}

export interface LogMethod {
  (
    err: Error | NodeJS.ErrnoException,
    str?: string | number,
    ...args: JsonValue[]
  ): void;
  (data: JsonValue, str?: string | number, ...args: JsonValue[]): void;
  (str: string | number): void;
  (
    dataOrStr: JsonValue | string | number | Error | NodeJS.ErrnoException,
    strOrArg1?: string | number,
    ...args: JsonValue[]
  ): void;
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
  context?: JsonObject;
}

function withNullProto<T extends Record<string, any>>(obj: T): T {
  return Object.assign(Object.create(null), obj);
}

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    (typeof value !== 'object' && typeof value !== 'function') || value === null
  );
}

function isLogDescriptor(log: LogDescriptor | Symbol): log is LogDescriptor {
  // console.log('%o is %s', log, isPlainObject(log));
  return isPlainObject(log);
}

const chokeProbe = Symbol('choke-probe');

export class Logger implements LogMethods {
  #inputStream = new PassThrough({
    objectMode: true,
    autoDestroy: true,
  });

  public als: AsyncLocalStorage<AlsContext>;

  public level: Level;

  #emitter = new Emittery<{
    log: LogDescriptor;
    error: unknown;
    flush: undefined;
  }>();

  #processorChain: Chain;

  #destination: Writable;

  /**
   *
   * @param options {LoggerOptions}
   */
  constructor(options: LoggerOptions) {
    const {
      level = Level.Info,
      transformer,
      processors: decorators = [],
      destination,
    } = options;

    this.als = new AsyncLocalStorage<AlsContext>();
    this.level = level;

    // TODO: validate decorators here
    // validate transformer also

    function processorWrapper(
      processor: Processor<LogDescriptor | Symbol> | Transformer,
    ): Processor<LogDescriptor | Symbol> | Transformer {
      if (typeof processor === 'function') {
        return async function wrappedProcessor(log: LogDescriptor | Symbol) {
          if (isLogDescriptor(log)) {
            return processor(log);
          }
          return log;
        };
      }

      return processor;
    }

    this.#processorChain = Chain.chain([
      ...[
        // pidProcessor,
        errorProcessor,
        callerProcessor,
        ...decorators,
        ...(transformer ? [transformer] : []),
      ].map((processor) => processorWrapper(processor)),
    ]);

    this.#destination = destination;

    this.#inputStream
      .pipe(this.#processorChain)
      .pipe(
        // filter out the choke probe
        Chain.chain([(obj) => (obj === chokeProbe ? null : obj)]),
      )
      .pipe(this.#destination);

    /* // debug
    ['drain', 'data', 'readable', 'resume'].forEach((eventName) => {
      destination.on(eventName, (...args) =>
        console.log('destination EVENT!!!!', { eventName, args }),
      );
    }); */
  }

  public static from(options: CreateLoggerOptions) {
    return new Logger({
      destination: process.stdout,
      transformer: jsonTransformer,
      level: Level.Info,
      ...options,
    });
  }

  #log(
    level: Level,
    strOrData: Error | JsonObject | string | number,
    strOrArg1?: string | number,
    ...args: JsonValue[]
  ): void {
    const log: LogDescriptor = withNullProto(
      isPrimitive(strOrData)
        ? {
            time: new Date(),
            level,
            msg: format(
              strOrData,
              ...(strOrArg1 ? [strOrArg1, ...args] : args),
            ),
          }
        : {
            time: new Date(),
            level,
            msg:
              typeof strOrArg1 !== 'undefined'
                ? format(strOrArg1, ...args)
                : strOrArg1,
            data: strOrData,
          },
    );

    // no await
    this.#emitter
      .emit('log', log)
      .catch((err) => this.#emitter.emit('error', err));

    this.#inputStream.write(log, (err: Error | null | undefined) => {
      if (err) {
        this.#emitter.emit('error', err);
      }
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
    this.#inputStream.write(chokeProbe);

    await new Promise<void>((resolve, reject) => {
      let t: NodeJS.Timeout | undefined;

      const stream = this.#processorChain;

      function detectChokeProbe(obj: LogDescriptor | Symbol) {
        if (obj === chokeProbe) {
          stream.removeListener('data', detectChokeProbe);
          stream.removeListener('error', reject);
          if (t) {
            clearTimeout(t);
          }

          resolve();
        }
      }

      stream.once('error', reject);
      stream.addListener('data', detectChokeProbe);

      t = setTimeout(() => detectChokeProbe(chokeProbe), 2000);
    }).catch((err) => this.#emitter.emit('error', err));

    await this.#emitter
      .emit('flush')
      .catch((err) => this.#emitter.emit('error', err));
  }

  public async end() {
    await this.flush();
    this.#inputStream.end();
    await finished(this.#destination);
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

export function createLogger(options: CreateLoggerOptions) {
  const logger = Logger.from(options);
  process.on('beforeExit', async () => {
    await logger.end();
  });
  return logger;
}
