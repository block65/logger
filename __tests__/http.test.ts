import * as pinoHttp from 'pino-http';
import * as pino from 'pino';
import * as http from 'http';
import { URL } from 'url';
import { createHttpLogger, createLogger } from '../lib/node';
import { expectStream } from './helpers';

const localPort = 18888;
const agent = new http.Agent({
  // @ts-ignore
  localPort, // reproducible tests
});

export async function doHttpStuff(
  httpLogger: pinoHttp.HttpLogger,
  index: number,
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

  const serverPort = 8888 + index;
  server.listen(serverPort);

  await new Promise((resolve) => {
    const url = new URL(`http://127.0.0.1:${serverPort}${options.url}`);

    http.get(
      {
        agent,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
      },
      () => {
        agent.destroy();
        server.close(resolve);
      },
    );
  });
}

export function testHttpLogger(opts: {
  level: string;
}): [pinoHttp.HttpLogger, Promise<pino.LogDescriptor>] {
  const [stream, logPromise] = expectStream();

  const logger = createLogger(opts, stream);
  const httpLogger = createHttpLogger(logger);
  return [httpLogger, logPromise];
}

describe('HTTP', () => {
  test('Errors', async () => {
    const [httpLogger, logPromise] = testHttpLogger({
      level: 'trace',
    });

    const url = '/broken-page';

    await doHttpStuff(httpLogger, 0, {
      statusCode: 500,
      url,
    });

    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Warns', async () => {
    const [httpLogger, logPromise] = testHttpLogger({
      level: 'trace',
    });

    const url = '/missing-page';

    await doHttpStuff(httpLogger, 1, {
      statusCode: 404,
      url,
    });

    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('OKs', async () => {
    const [httpLogger, logPromise] = testHttpLogger({
      level: 'trace',
    });

    const url = '/existing-page';

    await doHttpStuff(httpLogger, 2, {
      statusCode: 200,
      url,
    });

    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
