import { createWriteStream } from 'node:fs';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import { describe, expect, vi, test } from 'vitest';
import type { LogDescriptor } from '../lib/logger.ts';
import { createWritableStreamWithCallback, promiseWait } from './helpers.ts';

describe('Events', () => {
  test('flush works all day long', async () => {
    const { createLogger } = await import('../lib/node.ts');

    const destination = createWritableStreamWithCallback(() => {});

    const logger = createLogger({
      destination,
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
    const { createLogger } = await import('../lib/node.ts');

    const destination = createWritableStreamWithCallback(() => {});

    const randomLogProcessorFn = vi.fn((log: LogDescriptor) => log);

    const logger = createLogger({
      destination,
      processors: [
        async (log) => {
          await promiseWait(100);
          return randomLogProcessorFn(log);
        },
      ],
    });

    const callback = vi.fn(async (err: unknown) => err);
    logger.on('log', async (err) => {
      await callback(err);
    });

    const errback = vi.fn((err: unknown) => err);
    logger.on('error', (err) => {
      errback(err);
    });

    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');

    // Advance timers to allow async processors to complete
    await vi.advanceTimersByTimeAsync(1000);

    await logger.end();

    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');
    logger.info('Hello');

    await vi.advanceTimersByTimeAsync(1000);

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
