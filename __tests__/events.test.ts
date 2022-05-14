import { describe, expect, jest, test } from '@jest/globals';
import { createWriteStream } from 'node:fs';
import { PassThrough } from 'stream';
import { finished } from 'stream/promises';
import type { LogDescriptor } from '../lib/logger.js';
import { promiseWait } from './helpers.js';

describe('Events', () => {
  test('flush works all day long', async () => {
    const { createLogger } = await import('../lib/index.js');

    const logger = createLogger({
      destination: createWriteStream('/dev/null'),
    });

    await logger.flush();
    logger.info('Hello');
    await logger.flush();
    logger.info('Hello');
    await logger.flush();
    logger.info('Hello');
    await logger.flush();
    logger.info('Hello');
    await logger.flush();
    logger.info('Hello');
    await logger.flush();
  });

  test('logger.end', async () => {
    const { createLogger } = await import('../lib/index.js');

    const destination = createWriteStream('/dev/null');

    const randomLogProcessorFn = jest.fn((log: LogDescriptor) => log);

    const logger = createLogger({
      destination,
      processors: [
        async (log) => {
          await promiseWait(100);
          return randomLogProcessorFn(log);
        },
      ],
    });

    const callback = jest.fn(async (err) => err);
    logger.on('log', async (err) => {
      await callback(err);
    });

    const errback = jest.fn((err) => err);
    logger.on('error', (err) => {
      errback(err);
    });

    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');

    await logger.end();

    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');

    await logger.flush();

    expect(randomLogProcessorFn).toHaveBeenCalledTimes(6);
    expect(randomLogProcessorFn.mock.calls).toMatchSnapshot();

    expect(callback).toHaveBeenCalledTimes(6);
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('sanity stream finish', async () => {
    const stream1 = new PassThrough();
    const stream2 = createWriteStream('/dev/null');

    stream1.pipe(stream2);

    stream1.end();

    await finished(stream2);
  });

  test('sanity stream data', async () => {
    const stream1 = new PassThrough({
      objectMode: true,
    });
    const stream2 = new PassThrough({
      objectMode: true,
    });

    stream1.pipe(stream2);

    const obj = {};
    stream1.write(obj);

    await expect(
      new Promise((resolve) => {
        stream2.on('data', resolve);
      }),
    ).resolves.toMatchObject(obj);
  });
});
