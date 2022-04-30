import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('Context Wrapper', () => {
  const initialEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterEach(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  test('Lambda', async () => {
    const { withLambdaLoggerContextWrapper } = await import('../lib/lambda.js');

    const { createAutoConfiguredLoggerWithWaitableMock } = await import(
      './helpers.js'
    );

    const [logger, callback, errback] =
      createAutoConfiguredLoggerWithWaitableMock();

    logger.info('logger outside before');

    const childLogger = logger.child(
      {
        childData: '1',
      },
      {
        context: {
          childCtx: '1',
        },
      },
    );

    await withLambdaLoggerContextWrapper(
      childLogger,
      {
        awsRequestId: 'fake-request-id1',
        functionVersion: '999',
      },
      async () => {
        logger.info('logger inside');
        childLogger.info('childLogger inside');
      },
    );

    logger.info('logger outside after');

    await logger.end();

    await expect(callback.waitUntilCalledTimes(4)).resolves.toMatchSnapshot();

    expect(errback).not.toBeCalled();
  });
});
