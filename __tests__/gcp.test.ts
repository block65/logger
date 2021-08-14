import { testLogger } from './helpers.js';

describe('GCP', () => {
  test('Cloud Run', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'gcp-cloudrun',
    });

    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Cloud Run Error Object', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'gcp-cloudrun',
    });

    logger.error(new Error('Ded 1'));
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Cloud Run Fatal with Error Object', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'gcp-cloudrun',
    });

    logger.fatal(new Error('Ded 2'));
    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
