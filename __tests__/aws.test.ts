import { describe, expect, test } from '@jest/globals';
import { withLambdaLoggerContextWrapper } from '../lib/lambda.js';
import { createLoggerWithTmpfileDestination } from './helpers.js';

describe('AWS', () => {
  // beforeEach(() => {
  //   jest.useFakeTimers('modern');
  //   jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  // });

  // afterEach(() => {
  //   jest.useRealTimers();
  // });

  describe('Lambda', () => {
    test('Logger + contextId', async () => {
      const [logger, callback] = await createLoggerWithTmpfileDestination({
        platform: 'aws-lambda',
        logFormat: 'aws-cloudwatch',
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

      await logger.flushTransports();

      const logs = await callback();
      expect(logs).toBeTruthy();

      await expect(callback()).resolves.toMatchSnapshot();
    });

    test('Error Object', async () => {
      const [logger, callback] = await createLoggerWithTmpfileDestination({
        platform: 'aws-lambda',
        logFormat: 'aws-cloudwatch',
      });

      logger.error(new Error('Ded 4'));

      await logger.flushTransports();

      await expect(callback()).resolves.toMatchSnapshot();
    });
  });

  describe('ECS', () => {
    test('Error Object', async () => {
      const [logger, callback] = await createLoggerWithTmpfileDestination({
        platform: 'aws-ecs',
        logFormat: 'aws-cloudwatch',
      });

      logger.error(new Error('Ded 3'));

      await logger.flushTransports();

      // await new Promise((resolve) => setTimeout(resolve, 1000));

      await expect(callback()).resolves.toMatchSnapshot();
    });
  });
});
