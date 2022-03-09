import { AsyncLocalStorage } from 'node:async_hooks';
import type { Worker } from 'node:worker_threads';
import pino from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getPlatformLoggerOptions } from './options.js';
import { AlsContext, CreateLoggerOptions, Logger } from './types.js';
import { isPlainObject, stripUndefined } from './utils.js';

type VoidFunction = () => void | Promise<void>;

// awaiting https://github.com/pinojs/thread-stream/issues/24
interface ThreadStream {
  worker: Worker;
  write(data: any): boolean;
  end(): void;
  flush(cb: VoidFunction): void;
  flushSync(): void;
  unref(): void;
  ref(): void;
  get ready(): any;
  get destroyed(): any;
  get closed(): any;
  get writable(): boolean;
  get writableEnded(): any;
  get writableFinished(): any;
  get writableNeedDrain(): any;
  get writableObjectMode(): boolean;
  get writableErrored(): any;
}

export function createLogger(): Logger;
export function createLogger(
  opts: CreateLoggerOptions,
  destination?: string | number,
): Logger;
export function createLogger(
  opts: Omit<CreateLoggerOptions, 'prettyTransportOptions'>,
  destination: pino.DestinationStream,
): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  destination: string | number | pino.DestinationStream = process.stdout.fd,
): Logger {
  const asyncLocalStorage = new AsyncLocalStorage<AlsContext>();

  const { platform, traceCaller = false, mixins = [], ...userPinoOpts } = opts;

  const platformLoggerOptions = getPlatformLoggerOptions(platform);

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(asyncLocalStorage),
    traceCaller && callerMixin,
  ]);

  const resolvedOptions = {
    ...defaultLoggerOptions,
    ...platformLoggerOptions,
    ...stripUndefined(userPinoOpts),
  };

  const destinationIsStream =
    typeof destination === 'object' && 'write' in destination;

  const transport: ThreadStream = pino.transport({
    targets: [
      ...('prettyOptions' in resolvedOptions && resolvedOptions.prettyOptions
        ? [
            {
              target: './pretty-transport.js',
              level: resolvedOptions.level,
              options: isPlainObject(resolvedOptions.prettyOptions)
                ? {
                    ...resolvedOptions.prettyOptions,
                    destination,
                  }
                : { destination },
            },
          ]
        : [
            ...(typeof destination === 'string' ||
            typeof destination === 'number'
              ? [
                  {
                    target: 'pino/file',
                    level: resolvedOptions.level,
                    options: { destination },
                  },
                ]
              : []),
          ]),
      ...('sentryTransportOptions' in resolvedOptions &&
      resolvedOptions.sentryTransportOptions
        ? [
            {
              target: './sentry-transport.js',
              level:
                resolvedOptions.sentryTransportOptions.minLogLevel ||
                ('error' as const),
              options: resolvedOptions.sentryTransportOptions,
            },
          ]
        : []),
    ],
  } as pino.TransportMultiOptions);

  const pinoOptions: pino.LoggerOptions = {
    ...resolvedOptions,
    mixin,
  };

  const pinoInstance = destinationIsStream
    ? pino(pinoOptions, destination)
    : pino(pinoOptions, transport);

  return Object.create(pinoInstance, {
    flushTransports: {
      value: () =>
        new Promise<void>((resolve) => {
          // TODO: this needs to be checked to make sure it's not jest being odd
          // the flush callback never gets fired,
          // transport.flush(() => resolve());
          transport.flushSync();
          resolve();
        }),
      configurable: false,
      enumerable: false,
      writable: false,
    },
    als: {
      value: asyncLocalStorage,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });
}
