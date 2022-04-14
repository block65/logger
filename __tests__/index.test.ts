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
  const initialEnv = process.env;
  const originalStackTraceLimit = Error.stackTraceLimit;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterAll(() => {
    process.env = { ...initialEnv };
    Error.stackTraceLimit = originalStackTraceLimit;
    jest.useRealTimers();
  });

  test('Object', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Object with undefined props', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn({ omg: undefined });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('String, Object = Object ignored', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn('hello', { omg: true });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('String Format, Object', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn('hello %j spleen!', { omg: true });
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello %s', 'world');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Object, String Format, ...Primitives', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();

    logger.warn({ omg: true }, 'hello %s %s %d', 'world', 'and', 123);
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Object, String = No Format', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn({ omg: true }, 'hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.warn('hello');
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Trace Caller Force true (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      // traceCaller: true,
    });

    logger.warn('hello');
    await logger.end();

    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Trace Caller Force false (development)', async () => {
    process.env.NODE_ENV = 'development';
    Error.stackTraceLimit = 10;
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      // traceCaller: false,
    });

    logger.warn('hello');
    await logger.end();

    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Mixins basic + accum', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
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
    expect(errback).not.toBeCalled();
  });

  test('Mixins property overwrite', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
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
    expect(errback).not.toBeCalled();
  });

  test('allow undefined logger level', async () => {
    // jest.useRealTimers();

    const [logger, callback] = createLoggerWithWaitableMock({
      level: undefined,
    });

    expect(logger.level).toBe(Level.Info);

    logger.fatal(new Error('Fake'));
    logger.fatal(new Error('Fake'));

    await logger.end();

    expect(callback.mock.calls).toHaveLength(2);
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('allow flush and reuse', async () => {
    // jest.useRealTimers();

    const [logger, callback] = createLoggerWithWaitableMock();

    logger.fatal(new Error('Before 1'));
    logger.fatal(new Error('Before 2'));

    // wait for logs to flush
    await logger.flush();

    // log some more stuff
    logger.fatal(new Error('After 1'));
    logger.fatal(new Error('After 2'));

    await logger.end();

    expect(callback.mock.calls).toHaveLength(4);
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('context and release name co-exist', async () => {
    process.env.VERSION_NAME = 'logger@feedfacecafe';
    const [logger, callback] = createLoggerWithWaitableMock();

    logger.trace('stuff');
    logger.debug('oh debug yes');
    logger.info('Completed');
    logger.warn(new Error('Warn'));
    logger.error(new Error('Its an error'));
    logger.fatal(new Error('OMG fatal'));

    await logger.end();

    expect(callback.mock.calls).toHaveLength(6);
    expect(callback.mock.calls).toMatchSnapshot();
  });

  test('log levels', async () => {
    process.env.VERSION_NAME = 'logger@feedfacecafe';

    const [logger, callback] = createLoggerWithWaitableMock({
      level: Level.Fatal,
    });

    logger.trace('stuff');
    logger.debug('oh debug yes');
    logger.info('Completed');
    logger.warn(new Error('Warn'));
    logger.error(new Error('Its an error'));
    logger.fatal(new Error('OMG fatal'));

    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('change logger level', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      level: Level.Fatal,
    });

    logger.trace('hello');
    logger.fatal('boom');

    await logger.flush();

    await callback.waitUntilCalled();
    expect(callback).toHaveBeenCalledTimes(1);
    callback.mockClear();

    logger.setLevel(Level.Trace);

    logger.trace('hello');
    logger.fatal('boom');

    await logger.flush();

    await callback.waitUntilCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
