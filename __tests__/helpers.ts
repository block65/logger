import { jest } from '@jest/globals';
import Emittery from 'emittery';
import type { Mock } from 'jest-mock';
import { PassThrough } from 'node:stream';
import { createAutoConfiguredLogger } from '../lib/index.js';
import {
  CreateLoggerOptions,
  LogDescriptor,
  Level,
  Logger,
} from '../lib/logger.js';

interface WaitableMock<Y extends unknown[] = unknown[]> extends Mock<void, Y> {
  waitUntilCalled(): Promise<Y>;

  waitUntilCalledTimes(times: number): Promise<Y[]>;
}

export function waitableJestFn<
  Y extends unknown[] = unknown[],
>(): WaitableMock<Y> {
  const emitter = new Emittery<{ call: Y }>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = jest.fn((...args: Y): void => {
    emitter.emit('call', args).catch((err) => {
      console.warn(err);
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
export function promiseWait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createLoggerWithWaitableMock(
  options: Omit<CreateLoggerOptions, 'destination'> = {},
): [Logger, WaitableMock<[LogDescriptor]>, Mock<void>] {
  const destination = new PassThrough({ objectMode: true });
  const writeCallback = waitableJestFn<[LogDescriptor]>();
  const errBack = jest.fn((err) => {
    console.trace({ err });
  });

  destination.on('data', (val: LogDescriptor) => writeCallback(val));

  const logger = new Logger({
    destination,
    level: Level.Trace,
    ...options,
  });

  logger.on('error', errBack);

  return [logger, writeCallback, errBack];
}

export function createAutoConfiguredLoggerWithWaitableMock(
  options: Omit<CreateLoggerOptions, 'destination'> = {},
): [Logger, WaitableMock<[string]>, Mock<void>] {
  const destination = new PassThrough({ objectMode: true });
  const writeCallback = waitableJestFn<[string]>();
  const errBack = jest.fn((err) => {
    console.trace({ err });
  });

  destination.on('data', (val: string) => writeCallback(val));

  const logger = createAutoConfiguredLogger({
    destination,
    level: Level.Trace,
    ...options,
  });

  logger.on('error', errBack);

  return [logger, writeCallback, errBack];
}
