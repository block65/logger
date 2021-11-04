import { describe, expect, test } from '@jest/globals';
import { lambdaLogger } from '../lib/node.js';
import { loggerWithWaitableMock } from './helpers.js';

describe('AWS', () => {
  test('Lambda Logger + contextId', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    const contextId = 'fake-aws-request-id'; // randomBytes(12).toString('hex');

    const closure = lambdaLogger(logger.cls, contextId, { stuff: true });

    expect.assertions(1);

    await closure(async () => {
      logger.warn('hello');
      await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
    });
  });

  test('Lambda Error Object', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      platform: 'aws-lambda',
    });

    logger.error(new Error('Ded 4'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Error Object', async () => {
    const [logger, callback] = loggerWithWaitableMock({
      platform: 'aws',
    });

    logger.error(new Error('Ded 3'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });
});
