import { afterEach, describe, expect, test } from 'vitest';

describe('CLI', () => {
  const initialEnv = process.env;

  afterEach(() => {
    process.env = { ...initialEnv };
  });

  test('force-color on', async () => {
    const { createLoggerWithWaitableMock, Level } = await import(
      './helpers.ts'
    );
    const { createCliTransformer } = await import('../lib/transformers/cli.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
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
    const { createLoggerWithWaitableMock, Level } = await import(
      './helpers.ts'
    );
    const { createCliTransformer } = await import('../lib/transformers/cli.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
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
