import * as Emittery from 'emittery';
import * as pino from 'pino';
import { randomBytes } from 'crypto';
import { createLogger, CreateLoggerOptions, lambdaLogger } from '../lib/node';

type Log = pino.LogDescriptor & { msg: object };

function expectStream(): [pino.DestinationStream, Promise<Log>] {
  const emitter = new Emittery.Typed<{ write: string }>();
  const stream = {
    write: (str: string): void => {
      emitter.emit('write', str).catch((err) => {
        console.error(err);
        process.exit(1);
      });
    },
  };

  const promise = new Promise<Log>((resolve) => {
    emitter.on('write', (str) => {
      resolve(JSON.parse(str));
    });
  });

  return [stream, promise];
}

function testLogger(
  opts?: CreateLoggerOptions,
): [ReturnType<typeof createLogger>, Promise<Log>] {
  const [stream, logPromise] = expectStream();

  const logger = createLogger(opts, stream);
  return [logger, logPromise];
}

// test.only('Error', async () => {
//   const [logger, logPromise] = testLogger();
//
//   const contextId = Date.now().toString(32);
//   const contextWrapper = jestWrapper(logger.cls, contextId);
//
//   return new Promise((resolve) => {
//     contextWrapper(async () => {
//       logger.error('whut %s', 'cakes');
//
//       await expect(logPromise).resolves.toHaveProperty('level', 50);
//       await expect(logPromise).resolves.toHaveProperty('msg', 'whut cakes');
//       await expect(logPromise).resolves.toHaveProperty('_contextId', contextId);
//
//       resolve();
//     });
//   });
// });

test('Object', async () => {
  const [logger, logPromise] = testLogger();
  logger.warn({ omg: true });
  await expect(logPromise).resolves.toHaveProperty('level', 40);
  await expect(logPromise).resolves.toHaveProperty('omg', true);
});

test('Object + String', async () => {
  const [logger, logPromise] = testLogger();
  logger.warn('hello', { omg: true });
  await expect(logPromise).resolves.toHaveProperty('level', 40);
  await expect(logPromise).resolves.not.toHaveProperty('omg', true);
});

test('Object + String = Format', async () => {
  const [logger, logPromise] = testLogger();
  logger.warn('hello %o', { omg: true });
  await expect(logPromise).resolves.toHaveProperty('level', 40);
  await expect(logPromise).resolves.not.toHaveProperty('omg', true);
});

test('Object + String = Format', async () => {
  const [logger, logPromise] = testLogger();
  logger.warn({ omg: true }, 'hello');
  await expect(logPromise).resolves.toHaveProperty('level', 40);
  await expect(logPromise).resolves.toHaveProperty('omg', true);
  await expect(logPromise).resolves.toHaveProperty('msg', 'hello');
});

test('Plain logger, no context', async () => {
  const [logger, logPromise] = testLogger();
  logger.warn('hello');
  await expect(logPromise).resolves.not.toHaveProperty('_contextId');
});

test('lambdaLogger + contextId', async () => {
  const [logger, logPromise] = testLogger();

  const contextId = randomBytes(12).toString('hex');

  const closure = lambdaLogger(logger.cls, contextId, { stuff: true });

  await closure(async () => {
    logger.warn('hello');
    await expect(logPromise).resolves.toHaveProperty('_context', {
      stuff: true,
    });
    await expect(logPromise).resolves.toHaveProperty('_contextId', contextId);
  });
});

test('GCP Cloudrun Platform', async () => {
  const [logger, logPromise] = testLogger({
    platform: 'gcp-cloudrun',
  });

  logger.warn('hello');
  await expect(logPromise).resolves.toHaveProperty('severity', 'WARNING');
  await expect(logPromise).resolves.toHaveProperty('message', 'hello');
});

// test('Overwriting existing properties', async () => {
//   const [logger, logPromise] = testLogger();
//   const hostname = 'test.example.com';
//   logger.warn({v: 3});
//   await expect(logPromise).resolves.toHaveProperty('hostname', hostname);
// });
