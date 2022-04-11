import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('Auto Logger', () => {
  const initialEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterAll(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  test('GCP', async () => {
    process.env.K_CONFIGURATION = 'cfg';
    process.env.K_SERVICE = 'svc';
    process.env.K_REVISION = 'rev';

    const { createAutoConfiguredLoggerWithWaitableMock } = await import(
      './helpers.js'
    );

    const [logger, callback, errback] =
      createAutoConfiguredLoggerWithWaitableMock();

    logger.info('woo yeah!!!');
    logger.error(new TypeError('Unknown SmallInt'));
    logger.warn(new SyntaxError('this code stinks'));
    logger.warn({ err: new Error('Connection refused') });

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('AWS ECS', async () => {
    process.env.ECS_AVAILABLE_LOGGING_DRIVERS = 'aws-logs';

    const { createAutoConfiguredLoggerWithWaitableMock } = await import(
      './helpers.js'
    );

    const [logger, callback, errback] =
      createAutoConfiguredLoggerWithWaitableMock();

    logger.info('woo yeah!!!');
    logger.error(new Error('bad stuff'));
    logger.warn(new Error('bad stuff'));
    logger.warn({ err: new Error('bad stuff') });

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('AWS Lambda', async () => {
    process.env.AWS_LAMBDA_FUNCTION_VERSION = '$LATEST';
    const { createAutoConfiguredLoggerWithWaitableMock } = await import(
      './helpers.js'
    );
    const [logger, callback, errback] =
      createAutoConfiguredLoggerWithWaitableMock();

    logger.info('woo yeah!!!');
    logger.error(new Error('bad stuff'));
    logger.warn(new Error('bad stuff'));
    logger.warn({ err: new Error('bad stuff') });

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
