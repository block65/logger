import { createNamespace } from 'cls-hooked';
import pino from 'pino';
import {
  callerMixin,
  composeMixins,
  createContextMixin,
  MixinFnWithData,
} from './mixins.js';
import { defaultLoggerOptions } from './options.js';
import { PrettyTransportOptions } from './pretty-transport.js';
import { Falsy, Logger } from './types.js';

export interface CreateCliLoggerOptions
  extends Omit<pino.LoggerOptions, 'mixin' | 'prettyPrint' | 'prettifier'> {
  traceCaller?: boolean;
  mixins?: (MixinFnWithData | pino.MixinFn | Falsy)[];
}

/** @private */
let counter = 0;

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
