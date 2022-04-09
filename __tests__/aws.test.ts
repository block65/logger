import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { withLambdaLoggerContextWrapper } from '../lib/lambda.js';
import { createCloudwatchTransformer } from '../lib/transformers/cloudwatch.js';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('AWS', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Lambda', () => {
    test('Logger + contextId', async () => {
      const [logger, callback, errback] = createLoggerWithWaitableMock({
        transformer: createCloudwatchTransformer(),
      });

      await withLambdaLoggerContextWrapper(
        logger,
        {
          awsRequestId: '000fake-0000-000request-000-id',
          callbackWaitsForEmptyEventLoop: false,
          functionName: 'fakeFunctionName',
          functionVersion: '$LATEST',
          invokedFunctionArn: 'arn::::',
          logGroupName: 'fakeLogGroup',
          logStreamName: 'fakeLogStream',
          memoryLimitInMB: '128',
        },
        async () => {
          logger.warn('hello');
          logger.error(new Error('fake'));
        },
      );

      await logger.flush();

      await callback.waitUntilCalled();

      expect(errback).not.toBeCalled();
      expect(callback).toBeCalledTimes(2);
      expect(callback.mock.calls).toMatchSnapshot();
    });

    test('Error Object', async () => {
      const [logger, callback] = createLoggerWithWaitableMock({
        transformer: createCloudwatchTransformer(),
      });

      logger.error(new Error('Ded 4'));

      await logger.flush();

      await expect(callback.mock.calls).toMatchSnapshot();
    });
  });

  describe('ECS', () => {
    test('Error Object', async () => {
      const [logger, callback] = createLoggerWithWaitableMock({
        // decorators: [lambdaDecorator],
        transformer: createCloudwatchTransformer(),
      });

      logger.error(new Error('Ded 3'));

      await logger.flush();

      // await new Promise((resolve) => setTimeout(resolve, 1000));

      await expect(callback.mock.calls).toMatchSnapshot();
    });
  });
});
