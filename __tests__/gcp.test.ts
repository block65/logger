import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { loggerWithWaitableMock } from './helpers.js';

describe('GCP', () => {
  test('Cloud Run', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      platform: 'gcp-cloudrun',
    });

    logger.warn('hello');
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Cloud Run Error Object', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      platform: 'gcp-cloudrun',
    });

    logger.error(new Error('Ded 1'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Cloud Run Fatal with Error Object', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      platform: 'gcp-cloudrun',
    });

    logger.fatal(new Error('Ded 2'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });
});
