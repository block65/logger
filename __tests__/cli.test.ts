import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { cliLoggerWithWaitableMockWatchOnce } from './helpers.js';
jest.useRealTimers();

describe.skip('CLI', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  test('pretty logger no-color', async () => {
    process.env.NO_COLOR = 'true';
    const [logger, callback] = cliLoggerWithWaitableMockWatchOnce();
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
  });

  test('pretty logger force-color', async () => {
    process.env.FORCE_COLOR = 'true';
    const [logger, callback] = cliLoggerWithWaitableMockWatchOnce();
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
  });
});
