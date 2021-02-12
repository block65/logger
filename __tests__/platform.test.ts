import { lambdaLogger } from '../lib/node';
import { testLogger } from './helpers';

describe('Platform Loggers', () => {
  test('AWS Lambda Logger + contextId', async () => {
    const [logger, logPromise] = testLogger();

    const contextId = 'testContextId'; // randomBytes(12).toString('hex');

    const closure = lambdaLogger(logger.cls, contextId, { stuff: true });

    await closure(async () => {
      logger.warn('hello');
      await expect(logPromise).resolves.toMatchSnapshot();
    });
  });

  test('GCP Cloud Run', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'gcp-cloudrun',
    });

    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
