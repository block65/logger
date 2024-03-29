import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { type WriteStream } from 'node:fs';
import { PassThrough, type Writable } from 'node:stream';
import type { WriteStream as TtyWriteStream } from 'node:tty';
import Emittery, { type UnsubscribeFunction } from 'emittery';
import format from 'quick-format-unescaped';
import { serializeError } from 'serialize-error';
import Chain from 'stream-chain';
import type { JsonPrimitive } from 'type-fest';
import type { JsonifiableObject } from 'type-fest/source/jsonifiable.js';
import { isPlainObject, safeStringify } from './utils.js';

type JsonifiableObjectWithError = JsonifiableObject & {
  err?: Error | unknown | undefined;
};

interface LoggerOptions {
  destination: Writable;
  level?: Level | undefined;
  processors?: Processor[];
  transformer?: Transformer | undefined;
  context?: LogDescriptor['ctx'] | undefined;
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

export type CreateLoggerOptions = Partial<LoggerOptions>;

export type LogData = JsonifiableObjectWithError;

export interface LogDescriptor {
  time: Date;
  level: Level;
  msg?: JsonPrimitive;
  ctx?: JsonifiableObject;
  data?: LogData;
  err?: Error | unknown;
}

export type LogMethod = {
  (err: Error | unknown, str?: JsonPrimitive, ...args: unknown[]): void;
  (data: JsonifiableObject, str?: JsonPrimitive, ...args: unknown[]): void;
  (str: JsonPrimitive, ...args: unknown[]): void;
};

export interface AlsContext {
  id: string;
  context?: JsonifiableObject;
}

function stringifyIfNotUndefined<T extends unknown | undefined>(
  val: T,
): string | undefined {
  return typeof val !== 'undefined' ? String(val) : val;
}

export function withNullProto<T extends Record<string | number, unknown>>(
  obj: T,
): T {
  return Object.assign<object, T>(Object.create(null), obj);
}

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    (typeof value !== 'undefined' &&
      typeof value !== 'object' &&
      typeof value !== 'function') ||
    value === null
  );
}

function isLogDescriptor(log: LogDescriptor | symbol): log is LogDescriptor {
  return isPlainObject(log);
}

/**
 * Arguments are all set to unknown as we really can't trust the user
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
    const msg =
      typeof arg2 === 'string'
        ? format(arg2, args, {
            stringify: safeStringify,
          })
        : stringifyIfNotUndefined(arg2);

    return {
      time,
      level,
      ...(msg && { msg }),
      // this stops TS complaining about serializing array methods
      // it may not be necessary
      data: Object.fromEntries(arg1.map((value, idx) => [idx, value])),
    };
  }

  if (arg1 && isPlainObject(arg1)) {
    const { err, ...data } = arg1;

    const msg =
      typeof arg2 === 'string'
        ? format(arg2, args, {
            stringify: safeStringify,
          })
        : stringifyIfNotUndefined(arg2);

    if (err instanceof Error) {
      return {
        time,
        level,
        ...(msg && { msg }),
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
      ...(msg && { msg }),
      data: Object(arg1),
    };
  }

  const msg =
    typeof arg2 === 'string'
      ? format(arg2, args, {
          stringify: safeStringify,
        })
      : stringifyIfNotUndefined(arg1);

  // this includes things like Buffer
  if (
    arg1 &&
    typeof arg1 === 'object' &&
    'toJSON' in arg1 &&
    typeof arg1.toJSON === 'function'
  ) {
    return {
      time,
      level,
      ...(msg && { msg }),
      data: Object(arg1.toJSON()),
    };
  }

  return {
    time,
    level,
    ...(msg && { msg }),
  };
}

export class Logger {
  #inputStream = new PassThrough({
    objectMode: true,
    autoDestroy: true,
  });

  public readonly als: AsyncLocalStorage<AlsContext>;

  public level: Level;

  public readonly destination: Writable | WriteStream | TtyWriteStream;

  readonly #emitter = new Emittery<{
    log: LogDescriptor;
    error: unknown;
    flush: undefined;
    end: undefined;
  }>();

  readonly #processorChain: Chain;

  readonly #context: LogData | undefined;

  readonly #pipeCleanerChain: Chain;

  public setLevel(level: Level) {
    this.level = level;
  }

  #childLoggers = new Set<Logger>();

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

    this.destination = destination;

    // TODO: validate processors here
    // validate transformer also

    const processorWrapper = (
      processor: Processor<LogDescriptor | symbol> | Transformer,
    ): Processor<LogDescriptor | symbol> | Transformer => {
      if (typeof processor === 'function') {
        return async (log: LogDescriptor | symbol) => {
          // run the processor on anything log descriptor-ish
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
      (log) => log,
      ...[...processors, ...(transformer ? [transformer.bind(this)] : [])].map(
        (processor) => processorWrapper(processor),
      ),
    ]);

    this.#inputStream.on('error', (err) => this.#emitter.emit('error', err));
    this.#processorChain.on('error', (err) => this.#emitter.emit('error', err));

    this.#inputStream.pipe(this.#processorChain);

    // a chain to ignore the pipe cleaner symbol
    this.#pipeCleanerChain = Chain.chain([
      (obj) => (typeof obj === 'symbol' ? null : obj),
    ]);
    this.#pipeCleanerChain.on('error', (err) =>
      this.#emitter.emit('error', err),
    );

    this.#processorChain.pipe(this.#pipeCleanerChain);

    if (this.destination.writable) {
      this.#pipeCleanerChain.pipe(this.destination);
    } else {
      this.#emitter.emit('error', new Error('Destination is not writeable'));
    }

    this.destination.on('end', () => {
      this.#pipeCleanerChain.unpipe(this.destination);
    });
  }

  #write(
    level: Level,
    arg1: unknown,
    arg2?: unknown,
    ...args: unknown[]
  ): void {
    const alsContext = this.als.getStore();

    const hasAnyContext = !!this.#context || !!alsContext;

    const ctx = hasAnyContext
      ? {
          ...alsContext,
          ...this.#context,
        }
      : undefined;

    const log = Object.freeze(
      Object.assign(
        toLogDescriptor(level, arg1, arg2, ...args),
        ctx && { ctx },
      ),
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

  #updateMaxListeners(num: number) {
    this.#inputStream.setMaxListeners(
      Math.max(num, EventEmitter.defaultMaxListeners),
    );
  }

  public child(
    data: JsonifiableObject,
    options: Pick<LoggerOptions, 'level' | 'context' | 'processors'> = {},
  ) {
    // this prevents a MaxListenersExceededWarning when we create the new logger
    // +2 because it has 1 listener by default and as we are
    // pre-emptively increasing it *before* we create the new logger, that
    // makes the other +1
    this.#updateMaxListeners(this.#childLoggers.size + 2);

    const child = new Logger({
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

    this.#childLoggers.add(child);

    child.on('end', () => {
      this.#childLoggers.delete(child);
      // +1 because it already has a listener by default
      this.#updateMaxListeners(this.#childLoggers.size + 1);
    });

    return child;
  }

  public flush = async () => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const child of this.#childLoggers) {
      await child.flush();
    }

    const pipeCleaner = Symbol('pipe-cleaner');

    await new Promise<void>((resolve, reject) => {
      let t: NodeJS.Timeout | undefined;

      const detectPipeCleaner = (obj: LogDescriptor | symbol) => {
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
  };

  public end = async () => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const child of this.#childLoggers) {
      await child.end();
    }

    await this.flush();

    [this.#inputStream, this.#processorChain, this.#pipeCleanerChain].forEach(
      (stream) => {
        stream.destroy();
        stream.unpipe().removeAllListeners();
      },
    );

    await this.#emitter
      .emit('end')
      .catch((err) => this.#emitter.emit('error', err));

    this.#emitter.clearListeners();
  };

  public on<Name extends 'log' | 'error' | 'flush' | 'end'>(
    event: Name | Name[],
    fn: (
      eventData: {
        log: LogDescriptor;
        error: unknown;
        flush: undefined;
        end: undefined;
      }[Name],
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.#emitter.on(event, fn);
  }

  public off<Name extends 'log' | 'error' | 'flush' | 'end'>(
    event: Name | Name[],
    fn: (
      eventData: {
        log: LogDescriptor;
        error: unknown;
        flush: undefined;
        end: undefined;
      }[Name],
    ) => void | Promise<void>,
  ): void {
    return this.#emitter.off(event, fn);
  }

  public trace: LogMethod = (...args) => {
    this.#write(Level.Trace, ...args);
  };

  public debug: LogMethod = (...args) => {
    this.#write(Level.Debug, ...args);
  };

  public info: LogMethod = (...args) => {
    this.#write(Level.Info, ...args);
  };

  public warn: LogMethod = (...args) => {
    this.#write(Level.Warn, ...args);
  };

  public error: LogMethod = (...args) => {
    this.#write(Level.Error, ...args);
  };

  public fatal: LogMethod = (...args) => {
    this.#write(Level.Fatal, ...args);
  };
}
