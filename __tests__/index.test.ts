import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('Basic', () => {
  const oldEnv = process.env;
  const originalStackTraceLimit = Error.stackTraceLimit;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
    process.env = { ...oldEnv };
    Error.stackTraceLimit = originalStackTraceLimit;
  });

  afterAll(() => {
    process.env = oldEnv;
    Error.stackTraceLimit = originalStackTraceLimit;
  });

  test('Object', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn({ omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object with undefined props', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn({ omg: undefined });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('String, Object', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn('hello', { omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('String Format, Object', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn('hello %o', { omg: true });
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello %s', 'world');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello %s:%s %d', 'world', 'and', 123);
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithWaitableMock();
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force true (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithWaitableMock({
      traceCaller: true,
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force false (development)', async () => {
    process.env.NODE_ENV = 'development';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithWaitableMock({
      traceCaller: false,
    });
    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Mixins basic + accum', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock({
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
    const [logger, callback] = await createLoggerWithWaitableMock({
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

  test('allow undefined logger level', async () => {
    await createLoggerWithWaitableMock({
      level: undefined,
    });
  });
});
