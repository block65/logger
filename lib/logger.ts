import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getPlatformLoggerOptions } from './options.js';
import type { PrettyTransportOptions } from './pretty-transport.js';
import {
  AlsContext,
  CreateCliLoggerOptions,
  CreateLoggerOptions,
  CreateLoggerOptionsWithoutTransports,
  Logger,
} from './types.js';

export function createLogger(
  opts?: CreateLoggerOptionsWithoutTransports,
  destination?: pino.DestinationStream,
): Logger;
export function createLogger(opts?: CreateLoggerOptions): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  destination?: pino.DestinationStream,
): Logger {
  const asyncLocalStorage = new AsyncLocalStorage<AlsContext>();

  const isDevelopment = process.env.NODE_ENV === 'development';

  const {
    platform,
    traceCaller = isDevelopment,
    mixins = [],
    ...userPinoOpts
  } = opts;

  const platformLoggerOptions = getPlatformLoggerOptions(platform);

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(asyncLocalStorage),
    traceCaller && callerMixin,
  ]);

  const pinoInstance = pino(
    {
      ...defaultLoggerOptions,
      ...platformLoggerOptions,
      ...userPinoOpts,
      mixin,
    },
    destination || process.stdout,
  );

  return Object.create(pinoInstance, {
    als: {
      value: asyncLocalStorage,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });
}

export function createCliLogger(
  opts: CreateCliLoggerOptions = {},
  destination: number | string = 1,
): Logger {
  const asyncLocalStorage = new AsyncLocalStorage<AlsContext>();

  const isDevelopment = process.env.NODE_ENV === 'development';

  const { traceCaller = isDevelopment, mixins = [], ...userPinoOpts } = opts;

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(asyncLocalStorage),
    traceCaller && callerMixin,
  ]);

  const prettyTransportOptions: PrettyTransportOptions = {
    destination,
  };

  const pinoInstance = pino({
    ...defaultLoggerOptions,
    ...userPinoOpts,
    mixin,
    transport: {
      targets: [
        {
          target: './pretty-transport.js',
          level: 'trace',
          options: prettyTransportOptions,
        },
      ],
    },
  });

  return Object.create(pinoInstance, {
    als: {
      value: asyncLocalStorage,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });
}
