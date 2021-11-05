import { createNamespace } from 'cls-hooked';
import pino from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getPlatformLoggerOptions } from './options.js';
import {
  CreateLoggerOptions,
  CreateLoggerOptionsWithoutTransports,
  Logger,
} from './types.js';

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
