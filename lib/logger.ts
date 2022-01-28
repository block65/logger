import { createNamespace } from 'cls-hooked';
import pino from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getPlatformLoggerOptions } from './options.js';
import type { PrettyTransportOptions } from './pretty-transport.js';
import {
  CreateCliLoggerOptions,
  CreateLoggerOptions,
  CreateLoggerOptionsWithoutTransports,
  Logger,
} from './types.js';

// `process.namespaces` is tacked on by cls-hooked (hacky imho)
// and does not play nice with `jest-resolve` which expects the shape
// of the process module to match that of node:process *at all times*
// we force `namespaces` to be not-enumerable here so it is ignored by `jest-resolve`
// when it attempts to list the keys/entries of the module
Object.defineProperty(process, 'namespaces', {
  enumerable: false, // jest-resolve should ignore it
  writable: true, // cls-hooked writes to it
});

/** @private */
let counter = 0;

export function createLogger(
  opts?: CreateLoggerOptionsWithoutTransports,
  destination?: pino.DestinationStream,
): Logger;
export function createLogger(opts?: CreateLoggerOptions): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  destination?: pino.DestinationStream,
): Logger {
  const cls = createNamespace(`logger/${counter}`);
  counter += 1;

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
    createContextMixin(cls),
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
    cls: {
      value: cls,
      configurable: false,
    },
  });
}

export function createCliLogger(
  opts: CreateCliLoggerOptions = {},
  destination: number | string = 1,
): Logger {
  const cls = createNamespace(`logger/${counter}`);
  counter += 1;

  const isDevelopment = process.env.NODE_ENV === 'development';

  const { traceCaller = isDevelopment, mixins = [], ...userPinoOpts } = opts;

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(cls),
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
    cls: {
      value: cls,
      configurable: false,
    },
  });
}
