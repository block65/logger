import * as http from 'http';
import * as Emittery from 'emittery';
import * as pinoHttp from 'pino-http';
import * as pino from 'pino';
import { randomBytes } from 'crypto';
import {
  createHttpLogger,
  createLogger,
  CreateLoggerOptions,
  lambdaLogger,
} from '../lib/node';

type Log = pino.LogDescriptor; // & { msg: Record<string, unknown> };

async function doHttpStuff(
  httpLogger: pinoHttp.HttpLogger,
  options: {
    statusCode: number;
    url: string;
  },
): Promise<void> {
  const server = http.createServer((req, res) => {
    httpLogger(req, res);
    res.writeHead(options.statusCode);
    res.end('Hello, World!');
  });

  const port = 8086;
  server.listen(port);

  await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}${options.url}`, () => {
      server.close(resolve);
    });
  });
}

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

function testHttpLogger(opts: {
  level: string;
}): [pinoHttp.HttpLogger, Promise<Log>] {
  const [stream, logPromise] = expectStream();

  const logger = createLogger(opts, stream);
  const httpLogger = createHttpLogger(logger);
  return [httpLogger, logPromise];
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

test('HTTP Logger Errors', async () => {
  const [httpLogger, logPromise] = testHttpLogger({
    level: 'trace',
  });

  const url = '/broken-page';

  await doHttpStuff(httpLogger, {
    statusCode: 500,
    url,
  });

  await expect(logPromise).resolves.toHaveProperty('level', 50);
});

test('HTTP Logger Warns', async () => {
  const [httpLogger, logPromise] = testHttpLogger({
    level: 'trace',
  });

  const url = '/missing-page';

  await doHttpStuff(httpLogger, {
    statusCode: 404,
    url,
  });

  await expect(logPromise).resolves.toHaveProperty('level', 40);
});

test('HTTP Logger OKs', async () => {
  const [httpLogger, logPromise] = testHttpLogger({
    level: 'trace',
  });

  const url = '/existing-page';

  await doHttpStuff(httpLogger, {
    statusCode: 200,
    url,
  });

  await expect(logPromise).resolves.toHaveProperty('msg', '200 OK');
  await expect(logPromise).resolves.toHaveProperty('level', 10);
  await expect(logPromise).resolves.toHaveProperty('url', url);
  await expect(logPromise).resolves.toHaveProperty('res.statusCode', 200);
});
