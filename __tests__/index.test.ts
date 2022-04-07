import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { Level } from '../lib/logger.js';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('Basic', () => {
  const oldEnv = process.env;
  const originalStackTraceLimit = Error.stackTraceLimit;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterAll(() => {
    process.env = { ...oldEnv };
    Error.stackTraceLimit = originalStackTraceLimit;
    jest.useRealTimers();
  });

  test('Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true });

    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Object with undefined props', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn({ omg: undefined });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('String, Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn('hello', { omg: true });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('String Format, Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn('hello %o', { omg: true });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello %s', 'world');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello %s:%s %d', 'world', 'and', 123);
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Trace Caller Force true (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = createLoggerWithWaitableMock({
      // traceCaller: true,
    });
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Trace Caller Force false (development)', async () => {
    process.env.NODE_ENV = 'development';
    Error.stackTraceLimit = 10;
    const [logger, callback] = createLoggerWithWaitableMock({
      // traceCaller: false,
    });
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Mixins basic + accum', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [
        (log) => ({
          ...log,
          data: {
            ...log.data,
            logger: {
              go: 'log',
            },
          },
        }),
        (log) => ({
          ...log,
          data: {
            ...log.data,
            luger: {
              go: 'bang',
            },
          },
        }),
        (log) => ({
          ...log,
          data: {
            ...log.data,
            // accum: log.data,
          },
        }),
      ],
    });
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Mixins property overwrite', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [
        (log) => ({
          ...log,
          data: {
            logger: {
              go: 'log',
            },
          },
        }),
        (log) => ({
          ...log,
          data: {
            logger: {
              go: 'brrr',
            },
          },
        }),
      ],
    });
    logger.warn('hello');
    await logger.end();

    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('allow undefined logger level', async () => {
    // jest.useRealTimers();

    const [logger, getLogs] = createLoggerWithWaitableMock({
      level: undefined,
    });

    expect(logger.level).toBe(Level.Info);

    logger.fatal(new Error('Fake'));
    logger.fatal(new Error('Fake'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(2);
    expect(getLogs.mock.calls).toMatchSnapshot();
  });

  test('allow flush and reuse', async () => {
    // jest.useRealTimers();

    const [logger, getLogs] = createLoggerWithWaitableMock();

    logger.fatal(new Error('Before 1'));
    logger.fatal(new Error('Before 2'));

    // wait for logs to flush
    await logger.flush();

    // log some more stuff
    logger.fatal(new Error('After 1'));
    logger.fatal(new Error('After 2'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(4);
    expect(getLogs.mock.calls).toMatchSnapshot();
  });

  test('context and release name co-exist', async () => {
    process.env.VERSION_NAME = 'logger@feedfacecafe';

    const [logger, getLogs] = createLoggerWithWaitableMock({
      level: undefined,
    });

    logger.trace('stuff');
    logger.debug('oh debug yes');
    logger.info('Completed');
    logger.warn(new Error('Warn'));
    logger.error(new Error('Its an error'));
    logger.fatal(new Error('OMG fatal'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(6);
    expect(getLogs.mock.calls).toMatchSnapshot();
  });
});
