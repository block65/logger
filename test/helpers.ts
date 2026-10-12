import Emittery from 'emittery';
import { vi, type Mock } from 'vitest';
import { createLogger } from '../lib/node.ts';
import {
  Level,
  Logger,
  type CreateLoggerOptions,
  type LogDescriptor,
} from '../lib/logger.ts';

interface WaitableMock<TArgs extends unknown[] = unknown[]>
  extends Mock<(...args: TArgs) => void> {
  waitUntilCalled(): Promise<TArgs>;
  waitUntilCalledTimes(times: number): Promise<TArgs[]>;
}

export { Level };

export function waitableMockFn<
  TArgs extends unknown[] = unknown[],
>(): WaitableMock<TArgs> {
  const emitter = new Emittery<{ call: TArgs }>();

  const fn = vi.fn((...args: TArgs): void => {
    emitter.emit('call', args).catch((err) => {
      console.warn(err);
      process.exitCode = 1;
    });
  });

  const waitUntilCalledTimes = (times: number) =>
    new Promise<TArgs[]>((resolve) => {
      const maybeResolve = () => {
        if (fn.mock.calls.length >= times) {
          emitter.clearListeners();
          resolve(fn.mock.calls as TArgs[]);
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
  }) as WaitableMock<TArgs>;
}

export function promiseWait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createWritableStreamWithCallback<T>(
  callback: (chunk: T) => void,
): WritableStream<T> {
  return new WritableStream<T>({
    write(chunk) {
      callback(chunk);
    },
  });
}

export function createLoggerWithWaitableMock(
  options: Omit<CreateLoggerOptions, 'destination'> = {},
): [Logger, WaitableMock<[LogDescriptor]>, Mock] {
  const writeCallback = waitableMockFn<[LogDescriptor]>();
  const errBack = vi.fn((err: unknown) => {
    console.trace(err);
  });

  const destination = createWritableStreamWithCallback<LogDescriptor>(
    (chunk) => writeCallback(chunk),
  );

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
  const writeCallback = waitableMockFn<[string]>();
  const errBack = vi.fn((err: unknown) => {
    console.trace(err);
  });

  const destination = createWritableStreamWithCallback<string>(
    (chunk) => writeCallback(chunk),
  );

  const logger = createLogger({
    destination,
    level: Level.Trace,
    ...options,
  });

  logger.on('error', errBack);

  return [logger, writeCallback, errBack];
}
