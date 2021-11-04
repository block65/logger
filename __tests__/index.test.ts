import { describe, expect, test } from '@jest/globals';
import { loggerWithWaitableMock } from './helpers.js';

describe('Basic', () => {
  test('Object', async () => {
    const [logger, callback] = loggerWithWaitableMock();
    logger.warn({ omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object with undefined props', async () => {
    const [logger, callback] = loggerWithWaitableMock();
    logger.warn({ omg: undefined });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('String, Object', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn('hello', { omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('String Format, Object', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn('hello %o', { omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello %s', 'world');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello %s:%s %d', 'world', 'and', 123);
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback] = loggerWithWaitableMock();

    const previousStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 10;
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toHaveProperty('caller');
    Error.stackTraceLimit = previousStackTraceLimit;
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    const [logger, callback] = loggerWithWaitableMock();

    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.not.toHaveProperty(
      'caller',
    );
  });

  test('Trace Caller Force (production)', async () => {
    process.env.NODE_ENV = 'production';
    const [logger, callback] = loggerWithWaitableMock({
      traceCaller: true,
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback] = loggerWithWaitableMock({
      traceCaller: false,
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.not.toHaveProperty(
      'caller',
    );
  });

  test('Mixins basic + accum', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      mixins: [
        () => ({
          logger: {
            go: 'log',
          },
        }),
        () => ({
          luger: {
            go: 'bang',
          },
        }),
        (accum) => ({
          accum,
        }),
      ],
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Mixins property overwrite', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      mixins: [
        () => ({
          logger: {
            go: 'log',
          },
        }),
        () => ({
          logger: {
            go: 'brrr',
          },
        }),
      ],
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });
});
