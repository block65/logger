import { PassThrough } from 'node:stream';
import { jest } from '@jest/globals';
import Emittery from 'emittery';
import type { Mock } from 'jest-mock';
import { createLogger } from '../lib/index.js';
import {
  Level,
  Logger,
  type CreateLoggerOptions,
  type LogDescriptor,
} from '../lib/logger.js';

interface WaitableMock<TArgs extends unknown[] = unknown[]>
  extends Mock<(...args: TArgs) => void> {
  waitUntilCalled(): Promise<TArgs>;

  waitUntilCalledTimes(times: number): Promise<TArgs[]>;
}

// helper only, might save import
export { Level };

export function waitableJestFn<
  TArgs extends unknown[] = unknown[],
>(): WaitableMock<TArgs> {
  const emitter = new Emittery<{ call: TArgs }>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = jest.fn((...args: TArgs): void => {
    // console.log('waitableJestFn called with', { args });
    emitter.emit('call', args).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(err);
      process.exitCode = 1;
    });
  });

  const waitUntilCalledTimes = (times: number) =>
    new Promise<TArgs[]>((resolve) => {
      const maybeResolve = () => {
        if (fn.mock.calls.length >= times) {
          emitter.clearListeners();
          resolve(fn.mock.calls);
        }
      };
      emitter.on('call', maybeResolve);
      maybeResolve();
    });

  const waitUntilCalled = async (): Promise<TArgs> => {
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
): [Logger, WaitableMock<[LogDescriptor]>, Mock] {
  const destination = new PassThrough({ objectMode: true });
  const writeCallback = waitableJestFn<[LogDescriptor]>();
  const errBack = jest.fn((err: unknown) => {
    // eslint-disable-next-line no-console
    console.trace(err);
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
): [Logger, WaitableMock<[string]>, Mock] {
  const destination = new PassThrough({ objectMode: true });
  const writeCallback = waitableJestFn<[string]>();
  const errBack = jest.fn((err: unknown) => {
    // eslint-disable-next-line no-console
    console.trace(err);
  });

  destination.on('data', (val: string) => writeCallback(val));

  const logger = createLogger({
    destination,
    level: Level.Trace,
    ...options,
  });

  logger.on('error', errBack);

  return [logger, writeCallback, errBack];
}
