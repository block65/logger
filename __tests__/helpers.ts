import { jest } from '@jest/globals';
import { randomBytes } from 'crypto';
import Emittery from 'emittery';
import type { Mock } from 'jest-mock';
import { open, readFile, watch } from 'node:fs/promises';
import pino from 'pino';
import { PassThrough } from 'stream';
import { createCliLogger, createLogger } from '../lib/logger.js';
import {
  CreateCliLoggerOptions,
  CreateLoggerOptionsWithoutTransports,
  LogDescriptor,
  Logger,
} from '../lib/types.js';

interface WaitableMock<Y extends unknown[] = unknown[]> extends Mock<void, Y> {
  waitUntilCalled(): Promise<Y[0]>;

  waitUntilCalledTimes(times: number): Promise<Y[]>;
}

export function waitableJestFn<
  Y extends unknown[] = unknown[],
>(): WaitableMock<Y> {
  const emitter = new Emittery<{ call: Y }>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = jest.fn((...args: Y): void => {
    emitter.emit('call', args).catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
  });

  const waitUntilCalledTimes = (times: number) => {
    return new Promise<Y[]>((resolve) => {
      const maybeResolve = () => {
        if (fn.mock.calls.length >= times) {
          emitter.clearListeners();
          resolve(fn.mock.calls);
        }
      };
      emitter.on('call', maybeResolve);
      maybeResolve();
    });
  };

  const waitUntilCalled = async (): Promise<Y> => {
    const [call] = await waitUntilCalledTimes(1);
    if (!call) {
      throw new Error('Falsy call found. This is most likely a bug');
    }
    return call;
  };

  return Object.assign(fn, {
    waitUntilCalledTimes,
    waitUntilCalled,
  });
}

export function loggerWithWaitableMock(
  opts?: CreateLoggerOptionsWithoutTransports,
): [Logger, WaitableMock<[LogDescriptor][]>] {
  const destination = new PassThrough();
  const writeCallback = waitableJestFn<[[LogDescriptor]]>();
  destination.on('data', (buff: Buffer) =>
    writeCallback(JSON.parse(buff.toString())),
  );

  const logger = createLogger(opts, destination);
  return [logger, writeCallback];
}

export function cliLoggerWithWaitableMockWatchOnce(
  opts?: CreateCliLoggerOptions,
): [Logger, WaitableMock<string[]>] {
  const logFile = '/tmp/tmp.' + randomBytes(3).toString('base64url');
  const logger = createCliLogger(opts, logFile);

  const writeCallback = waitableJestFn<[string]>();

  const controller = new AbortController();
  const { signal } = controller;

  (async () => {
    try {
      const handle = await open(logFile, 'w+');
      const watcher = watch(logFile, { signal });

      for await (const event of watcher) {
        if (event.eventType === 'change') {
          const buff = await readFile(handle);
          writeCallback(buff.toString());

          // do it once and then close up
          await handle.close();
          if (!signal.aborted) {
            controller.abort();
          }
        }
      }
    } catch (err) {
      if (Object(err).name === 'AbortError') {
        return;
      }
      if (!signal.aborted) {
        controller.abort();
      }
      console.error(err);
      process.exitCode = 1;
      throw err;
    }
  })();

  return [logger, writeCallback];
}

export function vanillaLoggerWithWaitableMock(
  opts: pino.LoggerOptions = {},
): [pino.Logger, WaitableMock<LogDescriptor[]>] {
  const destination = new PassThrough();
  const writeCallback = waitableJestFn<[LogDescriptor]>();
  destination.on('data', (buff: Buffer) =>
    writeCallback(JSON.parse(buff.toString())),
  );

  const logger = pino(opts, destination);
  return [logger, writeCallback];
}

// export function expectTransport(): [
//   pino.TransportSingleOptions,
//   Promise<Emittery<{ write: string }>>,
// ] {
//   const emitter = new Emittery<{ write: string }>();
//
//   const promise = new Promise<T>((resolve) => {
//     emitter.on('write', (str) => {
//       resolve(JSON.parse(str));
//     });
//   });
//
//   return [
//     {
//       target: 'test-transport',
//       options: {} as TestTransportOpts,
//     },
//     emitter,
//   ];
// }
