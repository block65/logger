import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getPlatformLoggerOptions } from './options.js';
import {
  AlsContext,
  CreateLoggerOptions,
  CreateLoggerOptionsWithDestination,
  Logger,
} from './types.js';
import { isPlainObject } from './utils.js';
import { isPlainObject, stripUndefined } from './utils.js';

export function createLogger(
  opts?: CreateLoggerOptions,
  destination?: string | number,
): Logger;
export function createLogger(
  opts: CreateLoggerOptionsWithDestination,
  destination?: string | number | pino.DestinationStream,
): Logger;
export function createLogger(
  opts: CreateLoggerOptionsWithDestination,
  destination: string | number | pino.DestinationStream,
): Logger;
export function createLogger(
  opts: CreateLoggerOptions | CreateLoggerOptionsWithDestination = {},
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

  const pinoOptions: pino.LoggerOptions = {
    ...resolvedOptions,
    mixin,
    ...(!destinationIsStream && {
      transport: {
        targets: [
          ...('prettyOptions' in resolvedOptions &&
          resolvedOptions.prettyOptions
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
      } as pino.TransportMultiOptions,
    }),
  };

  const pinoInstance = destinationIsStream
    ? pino(pinoOptions, destination)
    : pino(pinoOptions);

  return Object.create(pinoInstance, {
    als: {
      value: asyncLocalStorage,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });
}
