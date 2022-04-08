import { beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('CLI', () => {
  jest.useRealTimers();

  const oldEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
  });

  test('no-color', async () => {
    process.env.NO_COLOR = 'true';

    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const transformer = createCliTransformer();

    const [logger, callback] = createLoggerWithWaitableMock({
      transformer,
    });
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao2'));
    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
  });

  test('force-color', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const transformer = createCliTransformer({
      color: true,
    });

    const [logger, callback] = createLoggerWithWaitableMock({
      transformer,
    });

    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
  });
});
