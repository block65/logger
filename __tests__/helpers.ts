import pino from 'pino';
import * as Emittery from 'emittery';
import { createLogger, CreateLoggerOptions } from '../lib/node.js';

export function expectStream(): [
  pino.DestinationStream,
  Promise<pino.LogDescriptor>,
] {
  const emitter = new Emittery<{ write: string }>();
  const stream = {
    write: (str: string): void => {
      emitter.emit('write', str).catch((err) => {
        console.error(err);
        process.exit(1);
      });
    },
  };

  const promise = new Promise<pino.LogDescriptor>((resolve) => {
    emitter.on('write', (str) => {
      resolve(JSON.parse(str));
    });
  });

  return [stream, promise];
}

export function testLogger(
  opts?: CreateLoggerOptions,
): [ReturnType<typeof createLogger>, Promise<pino.LogDescriptor>] {
  const [stream, logPromise] = expectStream();

  const logger = createLogger(opts, stream);
  return [logger, logPromise];
}

export function testVanillaLogger(
  opts: pino.LoggerOptions = {},
): [pino.Logger, Promise<pino.LogDescriptor>] {
  const [stream, logPromise] = expectStream();

  const logger = pino(opts, stream);
  return [logger, logPromise];
}
