import { AsyncLocalStorage } from 'node:async_hooks';
import type { Worker } from 'node:worker_threads';
import pino, { TransportTargetOptions } from 'pino';
import { callerMixin, composeMixins, createContextMixin } from './mixins.js';
import { defaultLoggerOptions, getLogFormatOptions } from './options.js';
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

export function createLogger(): Logger;
export function createLogger(
  opts: CreateLoggerOptions,
  destination?: string | number,
): Logger;
export function createLogger(
  opts: CreateLoggerOptions,
  destination: pino.DestinationStream,
): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  dest: string | number | pino.DestinationStream = process.stdout.fd,
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

  if (logFormat === 'aws-cloudwatch') {
    disallowStream(logFormat, destinationIsStream);

    transportTargets.add({
      target: './transports/aws-cloudwatch.js',
      level: resolvedOptions.level,
      options: {
        dest,
        // sync on lambda because beforeExit and exit handlers dont get called
        // so it doesn't flush on its own
        sync: platform === 'aws-lambda',
      },
    });
  }

  if (!destinationIsStream && logFormat === 'cli') {
    disallowStream(logFormat, destinationIsStream);

    transportTargets.add({
      target: './transports/cli.js',
      level: resolvedOptions.level,
      options: { dest },
    });
  }

  if (!destinationIsStream && logFormat === 'gcp') {
    disallowStream(logFormat, destinationIsStream);

    transportTargets.add({
      target: './transports/file.js',
      level: resolvedOptions.level,
      options: { dest },
    });
  }

  if (userPinoOpts.sentryTransportOptions) {
    transportTargets.add({
      target: './transports/sentry.js',
      level:
        userPinoOpts.sentryTransportOptions.minLogLevel || ('error' as const),
      options: userPinoOpts.sentryTransportOptions,
    });
  }

  const targets = [...transportTargets];

  const hasTargetWithDestination = targets.some(
    (target) => 'dest' in target.options,
  );

  const transportStream =
    targets.length > 0
      ? pino.transport({
          targets,
        })
      : dest;

  const pinoOptions: PinoLoggerOptions = {
    ...resolvedOptions,
    mixin,
  };

  const destinationAsStream = destinationIsStream
    ? dest
    : pino.destination(dest);

  const pinoDestination =
    destinationIsStream || !hasTargetWithDestination
      ? destinationAsStream
      : transportStream;

  const pinoInstance = pino(pinoOptions, pinoDestination);

  return Object.create(pinoInstance, {
    flushTransports: {
      value: () =>
        new Promise<void>((resolve) => {
          // this only works some of the time
          // pinoDestination.flushSync();

          // this always works
          pinoDestination.end();

          // this never works and fails with fake timers too
          pinoDestination.flush(() => resolve());
          // resolve();
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
