import { describe, expect, test } from '@jest/globals';
import { lambdaLoggerContextWrapper } from '../lib/index.js';
import { loggerWithWaitableMock } from './helpers.js';

describe('AWS', () => {
  test('Lambda Logger + contextId', async () => {
    const [logger, callback] = loggerWithWaitableMock();

    const contextId = 'fake-aws-request-id';

    const closure = lambdaLoggerContextWrapper(logger.cls, contextId, {
      stuff: true,
    });

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
