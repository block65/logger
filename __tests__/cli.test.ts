import { beforeEach, describe, expect, jest, test } from '@jest/globals';

describe('CLI', () => {
  const oldEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
  });

  test('pretty logger no-color', async () => {
    process.env.NO_COLOR = 'true';
    const { cliLoggerWithWaitableMockWatchOnce } = await import('./helpers.js');

    const [logger, callback] = cliLoggerWithWaitableMockWatchOnce();
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
  });

  test('pretty logger force-color', async () => {
    const { cliLoggerWithWaitableMockWatchOnce } = await import('./helpers.js');

    const [logger, callback] = cliLoggerWithWaitableMockWatchOnce({
      color: true,
    });
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
  });
});
