import { lambdaLogger } from '../lib/node';
import { testLogger } from './helpers';

describe('AWS', () => {
  test('Lambda Logger + contextId', async () => {
    const [logger, logPromise] = testLogger();

    const contextId = 'testContextId'; // randomBytes(12).toString('hex');

    const closure = lambdaLogger(logger.cls, contextId, { stuff: true });

    await closure(async () => {
      logger.warn('hello');
      await expect(logPromise).resolves.toMatchSnapshot();
    });
  });

  test('Lambda Error Object', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'aws-lambda',
    });

    logger.error(new Error('Ded 4'));
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Error Object', async () => {
    const [logger, logPromise] = testLogger({
      platform: 'aws',
    });

    logger.error(new Error('Ded 3'));
    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
