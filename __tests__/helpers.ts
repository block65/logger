import { jest } from '@jest/globals';
import Emittery from 'emittery';
import type { Mock } from 'jest-mock';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { TextDecoder } from 'node:util';
import pino from 'pino';
import { createLogger } from '../lib/logger.js';
import { CreateLoggerOptions, LogDescriptor, Logger } from '../lib/types.js';

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

export async function createLoggerWithWaitableMock(
  opts: Omit<CreateLoggerOptions, 'prettyOptions'> = {},
): Promise<[Logger, WaitableMock<[LogDescriptor]>]> {
  const destination = new PassThrough();
  const writeCallback = waitableJestFn<[LogDescriptor]>();

  destination.on('data', (buff: Buffer) => {
    return writeCallback(JSON.parse(buff.toString()));
  });

  const logger = createLogger(opts, destination);

  return [logger, writeCallback];
}

export function createPinoLoggerWithWaitableMock(
  opts?: pino.LoggerOptions,
): [pino.Logger, WaitableMock<[LogDescriptor]>] {
  const destination = new PassThrough();
  const writeCallback = waitableJestFn<[LogDescriptor]>();

  destination.on('data', (buff: Buffer) => {
    return writeCallback(JSON.parse(buff.toString()));
  });

  const logger = pino(opts || {}, destination);
  return [logger, writeCallback];
}

function prepLogForStream(logs: LogDescriptor[]): string {
  return logs.map((l) => JSON.stringify(l)).join('\n');
}

export async function writeLogsToStream(
  transport: Writable,
  ...logs: LogDescriptor[]
) {
  transport.write(prepLogForStream(logs));

  await new Promise<void>((resolve) => {
    transport.end(resolve);
  });

  // await new Promise((resolve) => {
  //   setImmediate(resolve);
  // });
}

export function createTmpLogfileDest(): [
  destination: string,
  logs: () => Promise<string>,
] {
  const destination = join(
    tmpdir(),
    `jest-logger-pretty-${randomBytes(3).toString('base64url')}`,
  );

  return [
    destination,
    async () => {
      const logs = await readFile(destination).catch(
        (err: NodeJS.ErrnoException) => {
          // allow nonexistant files, as the logger may not have logged anything
          if (err.code === 'ENOENT') {
            return new ArrayBuffer(0);
          }
          throw err;
        },
      );

      return new TextDecoder().decode(logs);
    },
  ];
}
