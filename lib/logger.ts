import Emittery, {
  type EmitteryEvent,
  type UnsubscribeFunction,
} from 'emittery';
import format from 'quick-format-unescaped';
import { serializeError } from 'serialize-error';
import type { Jsonifiable, JsonPrimitive } from 'type-fest';
import { isPlainObject, safeStringify } from './utils.js';

export type JsonifiableObject = {[Key in string]?: Jsonifiable};

type JsonifiableObjectWithError = JsonifiableObject & {
  err?: Error | unknown | undefined;
};

interface LoggerOptions {
  destination: WritableStream<unknown>;
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

export const Level = {
  Silent: 0,
  Trace: 10,
  Debug: 20,
  Info: 30,
  Warn: 40,
  Error: 50,
  Fatal: 60,
}

export type Level = (typeof Level)[keyof typeof Level];

export type LevelAsString = Lowercase<keyof typeof Level>;

const stringLevelMap: Record<string, Level> = {
  silent: Level.Silent,
  trace: Level.Trace,
  debug: Level.Debug,
  info: Level.Info,
  warn: Level.Warn,
  error: Level.Error,
  fatal: Level.Fatal,
};

/**
 * Parse a string level to a Level enum value.
 * Returns undefined if the string is not a valid level.
 */
export function parseLevel(level: string | undefined): Level | undefined {
  if (level === undefined) {
    return undefined;
  }
  return stringLevelMap[level.toLowerCase()];
}

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
  // Controller for the input readable stream - allows multiple sources to enqueue
  #inputController: ReadableStreamDefaultController<LogDescriptor | symbol> | null =
    null;

  // Pending writes before the stream is ready
  #pendingWrites: Array<LogDescriptor | symbol> = [];

  // Callbacks for flush detection (symbol -> resolve function)
  #flushCallbacks = new Map<symbol, () => void>();

  // AbortController for the pipeline
  #abortController = new AbortController();

  // Track if the logger has ended
  #ended = false;

  // Track if the logger has been destroyed (cannot be used again)
  #destroyed = false;

  // Promise that resolves when the pipeline completes
  #pipelinePromise: Promise<void>;

  public level: Level;

  public readonly destination: WritableStream<unknown>;

  readonly #emitter = new Emittery<{
    log: LogDescriptor;
    error: unknown;
    flush: undefined;
    end: undefined;
  }>();

  readonly #context: LogData | undefined;

  public setLevel(level: Level) {
    this.level = level;
  }

  public get destroyed(): boolean {
    return this.#destroyed;
  }

  #childLoggers = new Set<Logger>();

  constructor(options: LoggerOptions) {
    const {
      level = Level.Info,
      transformer,
      processors = [],
      destination,
      context,
    } = options;

    this.#context = context && withNullProto(context);

    this.level = level;

    this.destination = destination;

    // Build the processor pipeline
    const allProcessors = [
      ...processors,
      ...(transformer ? [transformer.bind(this)] : []),
    ];

    // Create the input ReadableStream with a stored controller
    const inputReadable = new ReadableStream<LogDescriptor | symbol>({
      start: (controller) => {
        this.#inputController = controller;
        // Process any pending writes
        for (const item of this.#pendingWrites) {
          controller.enqueue(item);
        }
        this.#pendingWrites = [];
      },
    });

    // Create a TransformStream that runs all processors in sequence
    const processorTransform = new TransformStream<
      LogDescriptor | symbol,
      unknown
    >({
      transform: async (chunk, controller) => {
        // Pass symbols straight through (for flush detection)
        if (typeof chunk === 'symbol') {
          controller.enqueue(chunk);
          return;
        }

        // Run through all processors
        let result: unknown = chunk;
        for (const processor of allProcessors) {
          try {
            result = await processor.call(this, result as LogDescriptor);
          } catch (err) {
            this.#emitter.emit('error', err);
            result = chunk; // On error, use original
          }
        }
        controller.enqueue(result);
      },
    });

    // Create a TransformStream that filters symbols and triggers flush callbacks
    const pipeCleanerTransform = new TransformStream<unknown, unknown>({
      transform: (chunk, controller) => {
        if (typeof chunk === 'symbol') {
          // Trigger flush callback if registered
          const callback = this.#flushCallbacks.get(chunk);
          if (callback) {
            callback();
            this.#flushCallbacks.delete(chunk);
          }
          // Don't pass symbols to destination
          return;
        }
        controller.enqueue(chunk);
      },
    });

    // Connect the pipeline and store the promise
    this.#pipelinePromise = inputReadable
      .pipeThrough(processorTransform)
      .pipeThrough(pipeCleanerTransform)
      .pipeTo(destination, { signal: this.#abortController.signal })
      .catch((err) => {
        // Ignore abort errors
        if (err instanceof Error && err.name !== 'AbortError') {
          this.#emitter.emit('error', err);
        }
      });
  }

  #assertNotDestroyed(): void {
    if (this.#destroyed) {
      // throw new Error('Logger has been destroyed and cannot be used');
      console.warn('Logger has been destroyed and cannot be used');
    }
  }

  #enqueue(chunk: LogDescriptor | symbol): void {
    if (this.#ended || this.#destroyed) {
      return;
    }

    if (this.#inputController) {
      this.#inputController.enqueue(chunk);
    } else {
      this.#pendingWrites.push(chunk);
    }
  }

  #write(level: Level, arg1: unknown, arg2?: unknown, ...args: unknown[]): void {
    this.#assertNotDestroyed();

    const ctx = this.#context ? { ...this.#context } : undefined;

    const log = Object.freeze(
      Object.assign(toLogDescriptor(level, arg1, arg2, ...args), ctx && { ctx }),
    );

    if (log.level >= this.level) {
      this.#enqueue(log);
      this.#emitter
        .emit('log', log)
        .catch((err) => this.#emitter.emit('error', err));
    }
  }

  public child(
    data: JsonifiableObject,
    options: Pick<LoggerOptions, 'level' | 'context' | 'processors'> = {},
  ) {
    this.#assertNotDestroyed();

    // Create a fresh WritableStream for this child that enqueues to parent
    const childDestination = new WritableStream<LogDescriptor | symbol>({
      write: (chunk) => {
        this.#enqueue(chunk);
      },
    });

    const child = new Logger({
      level: options.level ?? this.level,
      destination: childDestination,
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
        ...(options.processors ?? []),
      ],
      context: options.context,
    });

    this.#childLoggers.add(child);

    child.on('end', () => {
      this.#childLoggers.delete(child);
    });

    return child;
  }

  public flush = async () => {
    if (this.#destroyed) {
      return;
    }

    for (const child of this.#childLoggers) {
      await child.flush();
    }

    if (this.#ended) {
      return;
    }

    const pipeCleaner = Symbol('pipe-cleaner');

    await new Promise<void>((resolve) => {
      this.#flushCallbacks.set(pipeCleaner, resolve);
      this.#enqueue(pipeCleaner);
    });

    await this.#emitter
      .emit('flush')
      .catch((err) => this.#emitter.emit('error', err));
  };

  public end = async () => {
    if (this.#destroyed) {
      return;
    }

    for (const child of this.#childLoggers) {
      await child.end();
    }

    await this.flush();

    this.#ended = true;

    // Close the input stream
    if (this.#inputController) {
      try {
        this.#inputController.close();
      } catch {
        // Already closed
      }
    }

    // Wait for the pipeline to fully complete
    await this.#pipelinePromise;

    await this.#emitter
      .emit('end')
      .catch((err) => this.#emitter.emit('error', err));

    this.#emitter.clearListeners();
  };

  public destroy = async () => {
    if (this.#destroyed) {
      return;
    }

    // Destroy all child loggers first
    for (const child of this.#childLoggers) {
      await child.destroy();
    }

    // Flush any pending logs before destroying
    await this.flush();

    this.#destroyed = true;
    this.#ended = true;

    // Abort the pipeline
    this.#abortController.abort();

    // Close the input stream
    if (this.#inputController) {
      try {
        this.#inputController.close();
      } catch {
        // Already closed
      }
    }

    // Wait for the pipeline to complete (will resolve due to abort)
    await this.#pipelinePromise;

    // Clear all listeners
    this.#emitter.clearListeners();

    // Clear child logger references
    this.#childLoggers.clear();

    // Clear any remaining flush callbacks
    this.#flushCallbacks.clear();
  };

  public on<Name extends 'log' | 'error' | 'flush' | 'end'>(
    event: Name | Name[],
    fn: (
      event: EmitteryEvent<
        Name,
        {
          log: LogDescriptor;
          error: unknown;
          flush: undefined;
          end: undefined;
        }[Name]
      >,
    ) => void | Promise<void>,
  ): UnsubscribeFunction {
    return this.#emitter.on(event, fn);
  }

  public off<Name extends 'log' | 'error' | 'flush' | 'end'>(
    event: Name | Name[],
    fn: (
      event: EmitteryEvent<
        Name,
        {
          log: LogDescriptor;
          error: unknown;
          flush: undefined;
          end: undefined;
        }[Name]
      >,
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
