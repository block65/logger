import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('AWS', () => {
  const initialEnv = process.env;
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterEach(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  describe('Lambda', () => {
    test('Logger + contextId', async () => {
      process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';

      const { createAutoConfiguredLoggerWithWaitableMock } = await import(
        './helpers.js'
      );
      const { withLambdaLoggerContextWrapper } = await import(
        '../lib/lambda.js'
      );

      const [logger, callback, errback] =
        createAutoConfiguredLoggerWithWaitableMock();

      const result = await withLambdaLoggerContextWrapper(
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
          return {
            somethingUseful: true,
          };
        },
      );

      expect(result).toMatchSnapshot();

      await callback.waitUntilCalled();

      expect(callback).toBeCalledTimes(2);
      expect(callback.mock.calls).toMatchSnapshot();
      expect(errback).not.toBeCalled();
    });
  });
});
