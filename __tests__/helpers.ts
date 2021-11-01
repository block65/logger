import Emittery from 'emittery';
import pino from 'pino';
import {
  createLogger,
  CreateLoggerOptionsWithoutTransports,
} from '../lib/node.js';
import type { LogDescriptor, Logger } from '../lib/types.js';

export function expectStream<T>(): [pino.DestinationStream, Promise<T>] {
  const emitter = new Emittery<{ write: string }>();
  const stream = {
    write: (str: string): void => {
      emitter.emit('write', str).catch((err) => {
        console.error(err);
        process.exitCode = 1;
        throw err;
      });
    },
  };

  const promise = new Promise<T>((resolve) => {
    emitter.on('write', (str) => {
      resolve(JSON.parse(str));
    });
  });

  return [stream, promise];
}

export function testLogger(
  opts: CreateLoggerOptionsWithoutTransports = {},
): [Logger, Promise<LogDescriptor>] {
  const [stream, logPromise] = expectStream<LogDescriptor>();

  const logger = createLogger(opts, stream);
  return [logger, logPromise];
}

export function testVanillaLogger(
  opts: pino.LoggerOptions = {},
): [pino.Logger, Promise<pino.LogDescriptor>] {
  const [stream, logPromise] = expectStream<pino.LogDescriptor>();

  const logger = pino(opts, stream);
  return [logger, logPromise];
}
