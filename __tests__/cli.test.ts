import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('CLI', () => {
  const initialEnv = process.env;
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  test('force-color on', async () => {
    const { createFileLoggerWithWaitableMock, Level } = await import(
      './helpers.js'
    );
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const [logger, callback, errback] = createFileLoggerWithWaitableMock({
      transformer: createCliTransformer({ color: true }),
      level: Level.Trace,
    });

    logger.fatal(new Error('herp'));
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await logger.flush();

    expect(errback).not.toHaveBeenCalled();
    await expect(callback.waitUntilCalledTimes(6)).resolves.toMatchSnapshot();
    expect(errback).not.toHaveBeenCalled();
  });

  test('force-color off', async () => {
    const { createFileLoggerWithWaitableMock, Level } = await import(
      './helpers.js'
    );
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const [logger, callback, errback] = createFileLoggerWithWaitableMock({
      transformer: createCliTransformer({ color: false }),
      level: Level.Trace,
    });
    logger.fatal(new Error('herp'));
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await logger.flush();

    expect(errback).not.toHaveBeenCalled();
    await expect(callback.waitUntilCalledTimes(6)).resolves.toMatchSnapshot();
    expect(errback).not.toHaveBeenCalled();
  });
});
