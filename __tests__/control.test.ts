import { describe, expect, test } from '@jest/globals';
import { testVanillaLogger } from './helpers.js';

describe('Control', () => {
  test('Error Object', async () => {
    const [logger, logPromise] = testVanillaLogger();
    logger.error(Object.assign(new Error('hallo'), { debug: 'wooyeah' }));
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Error Object serialized on non-error level', async () => {
    const [logger, logPromise] = testVanillaLogger();
    logger.info(new Error('hallo'));
    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
