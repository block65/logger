import { AsyncLocalStorage } from 'node:async_hooks';
import { Writable } from 'node:stream';
import pino, { DestinationStream, TransportTargetOptions } from 'pino';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getLogFormatOptions } from './options.js';
import {
  cloudwatchTransport,
  CloudwatchTransportOptions,
} from './transports/aws-cloudwatch.js';
import { cliTransport, CliTransportOptions } from './transports/cli.js';
import {
  AlsContext,
  CreateLoggerOptions,
  LogFormat,
  Logger,
  PinoLoggerOptions,
  PinoLoggerOptionsWithLevel,
} from './types.js';
import { stripUndefined } from './utils.js';

function disallowStream(logFormat: LogFormat, destinationIsStream: boolean) {
  if (destinationIsStream) {
    throw new Error(
      `Stream destination is not available with logFormat ${logFormat}`,
    );
  }
}

function createPinoInstance(
  options: PinoLoggerOptions,
  destination: Writable | SonicBoom | DestinationStream,
  opts: { asyncLocalStorage: AsyncLocalStorage<AlsContext> },
): Logger {
  const instance = pino(options, destination);
  return Object.create(instance, {
    ready: {
      value: () =>
        new Promise<void>((resolve) => {
          resolve();
        }),
      configurable: false,
      enumerable: false,
      writable: false,
    },
    flushTransports: {
      value: () =>
        new Promise<void>((resolve) => {
          instance.flush();
          if ('flush' in destination) {
            destination.flush();
          }
          resolve();
        }),
      configurable: false,
      enumerable: false,
      writable: false,
    },
    als: {
      value: opts.asyncLocalStorage,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });
}

export function createLogger(): Logger;
export function createLogger(
  opts: CreateLoggerOptions,
  destination?: string | number,
): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  dest: string | number = process.stdout.fd,
): Logger {
  const asyncLocalStorage = new AsyncLocalStorage<AlsContext>();

  const {
    logFormat: forceLogFormat,
    platform: forcePlatform,
    traceCaller = false,
    mixins = [],
    ...userPinoOpts
  } = opts;

  const [platform, logFormat, logFormatOptions] = getLogFormatOptions(
    dest,
    forcePlatform,
    forceLogFormat,
  );

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(asyncLocalStorage),
    traceCaller && callerMixin,
  ]);

  const resolvedOptions: PinoLoggerOptionsWithLevel = {
    ...defaultLoggerOptions,
    ...logFormatOptions,
    ...stripUndefined(userPinoOpts),
  };

  const destinationIsStream = typeof dest === 'object' && 'write' in dest;

  const transportTargets = new Set<TransportTargetOptions>();

  const pinoOptions: PinoLoggerOptions = {
    ...resolvedOptions,
    mixin,
  };

  if (logFormat === 'aws-cloudwatch') {
    disallowStream(logFormat, destinationIsStream);

    const transportOptions: CloudwatchTransportOptions = {
      dest,
      // sync on lambda because beforeExit and exit handlers dont get called
      // so it doesn't flush on its own
      sync: platform === 'aws-lambda',
    };

    transportTargets.add({
      target: './transports/aws-cloudwatch.js',
      level: resolvedOptions.level,
      options: transportOptions,
    });

    return createPinoInstance(
      pinoOptions,
      cloudwatchTransport(transportOptions),
      {
        asyncLocalStorage,
      },
    );
  }

  if (!destinationIsStream && logFormat === 'cli') {
    disallowStream(logFormat, destinationIsStream);

    const transportOptions: CliTransportOptions = { dest, sync: true };

    transportTargets.add({
      target: './transports/cli.js',
      level: resolvedOptions.level,
      options: transportOptions,
    });

    return createPinoInstance(pinoOptions, cliTransport(transportOptions), {
      asyncLocalStorage,
    });
  }

  if (!destinationIsStream && logFormat === 'gcp') {
    disallowStream(logFormat, destinationIsStream);

    const transportOptions: SonicBoomOpts = { dest, sync: true };

    transportTargets.add({
      target: 'pino/file',
      level: resolvedOptions.level,
      options: transportOptions,
    });

    return createPinoInstance(pinoOptions, pino.destination(transportOptions), {
      asyncLocalStorage,
    });
  }

  // if (userPinoOpts.sentryTransportOptions) {
  //   disallowStream(logFormat, destinationIsStream);

  //   const transportOptions = userPinoOpts.sentryTransportOptions;

  //   transportTargets.add({
  //     target: './transports/sentry.js',
  //     level:
  //       userPinoOpts.sentryTransportOptions.minLogLevel || ('error' as const),
  //     options: transportOptions,
  //   });

  //   return createPinoInstance(pinoOptions, sentryTransport(transportOptions), {
  //     asyncLocalStorage,
  //   });
  // }

  return createPinoInstance(
    pinoOptions,
    destinationIsStream
      ? dest
      : pino.destination({
          dest,
          sync: true,
        }),
    { asyncLocalStorage },
  );
}
