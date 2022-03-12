import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createLogger } from '../lib/index.js';
import {
  createLoggerWithTmpfileDestinationJson,
  generateTmpFilenameAndReaderJson,
} from './helpers.js';

describe('Basic', () => {
  const oldEnv = process.env;
  const originalStackTraceLimit = Error.stackTraceLimit;

  beforeEach(() => {
    // jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
    process.env = { ...oldEnv };
    Error.stackTraceLimit = originalStackTraceLimit;
  });

  afterAll(() => {
    process.env = oldEnv;
    Error.stackTraceLimit = originalStackTraceLimit;
    // jest.useRealTimers();
  });

  test('Object', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn({ omg: true });

    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Object with undefined props', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn({ omg: undefined });
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('String, Object', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn('hello', { omg: true });
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('String Format, Object', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn('hello %o', { omg: true });
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn({ omg: true }, 'hello %s', 'world');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();

    logger.warn({ omg: true }, 'hello %s:%s %d', 'world', 'and', 123);
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn({ omg: true }, 'hello');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn('hello');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson();
    logger.warn('hello');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force true (production)', async () => {
    process.env.NODE_ENV = 'production';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
      traceCaller: true,
    });
    logger.warn('hello');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force false (development)', async () => {
    process.env.NODE_ENV = 'development';
    Error.stackTraceLimit = 10;
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
      traceCaller: false,
    });
    logger.warn('hello');
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Mixins basic + accum', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
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
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Mixins property overwrite', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
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
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('allow undefined logger level', async () => {
    // jest.useRealTimers();

    const [destination, getLogs] = await generateTmpFilenameAndReaderJson();

    const logger = createLogger(
      {
        level: undefined,
      },
      destination,
    );

    expect(logger.level).toBe('info');

    logger.fatal(new Error('Fake'));
    logger.fatal(new Error('Fake'));

    // wait for logs to flush
    await logger.flushTransports();
    const logs = await getLogs();

    expect(logs).toBeTruthy();
    expect(logs).toHaveLength(2);
    expect(logs).toMatchSnapshot();
  });

  test('allow flush and reuse', async () => {
    // jest.useRealTimers();

    const [destination, getLogs] = await generateTmpFilenameAndReaderJson();

    const logger = createLogger({}, destination);

    logger.fatal(new Error('Before 1'));
    logger.fatal(new Error('Before 2'));

    // wait for logs to flush
    await logger.flushTransports();

    // log some more stuff
    logger.fatal(new Error('After 1'));
    logger.fatal(new Error('After 2'));

    // flush again
    await logger.flushTransports();

    const logs = await getLogs();

    expect(logs).toBeTruthy();
    expect(logs).toHaveLength(4);
    expect(logs).toMatchSnapshot();
  });
});
