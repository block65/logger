import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { lambdaLoggerContextWrapper } from '../lib/lambda.js';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('AWS', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Lambda Logger + contextId', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock();

    const contextId = 'fake-aws-request-id';

    const closure = lambdaLoggerContextWrapper(logger, contextId, {
      stuff: true,
    });

    expect.assertions(1);

    await new Promise<void>((resolve) => {
      closure(async () => {
        logger.warn('hello');
        await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
        resolve();
      });
    });
  });

  test('Lambda Error Object', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock({
      platform: 'aws-lambda',
    });

    logger.error(new Error('Ded 4'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Error Object', async () => {
    const [logger, callback] = await createLoggerWithWaitableMock({
      platform: 'aws',
    });

    logger.error(new Error('Ded 3'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });
});
