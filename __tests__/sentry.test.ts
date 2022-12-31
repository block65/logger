import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import * as sentryModule from '@sentry/node';

const captureException = jest.fn((/* exception, captureContext */) => 'yes');

const addBreadcrumb = jest.fn((/* exception, captureContext */) => 'yes');

const captureMessage = jest.fn((/* message, captureContext */) => 'yes');

const flush = jest.fn((/* message, captureContext */) => 'yes');

jest.unstable_mockModule('@sentry/node', () => ({
    ...sentryModule,
    flush,
    captureException,
    addBreadcrumb,
    captureMessage,
  }));

describe('Sentry processor', () => {
  beforeEach(() => {
    // jest.resetModules();
    jest.resetAllMocks();
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('listener one shot', async () => {
    const { Level } = await import('../lib/logger.js');

    const { createSentryListener } = await import('../lib/listener/sentry.js');

    const listener = createSentryListener({
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    listener({
      level: Level.Info,
      time: new Date(),
      msg: 'This happened before the error',
    });

    listener({
      level: Level.Error,
      time: new Date(),
      err: new Error('Oh its a fake error'),
    });

    expect(captureException).toBeCalledTimes(1);
    expect(addBreadcrumb).toBeCalledTimes(1);

    expect(captureException.mock.calls).toMatchSnapshot();
    expect(addBreadcrumb.mock.calls).toMatchSnapshot();
  });

  test('listener as processor', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const { createSentryListener } = await import('../lib/listener/sentry.js');

    const listener = createSentryListener({
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [listener],
    });

    logger.error(new Error('Oops kaboom'));

    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();

    expect(captureException).toBeCalledTimes(1);
    expect(captureException.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('listener attach', async () => {
    const { attachSentryListener } = await import('../lib/listener/sentry.js');
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback, errback] = createLoggerWithWaitableMock();
    attachSentryListener(logger);

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.flush();

    expect(callback.mock.calls).toHaveLength(3);

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.end();

    expect(callback.mock.calls).toHaveLength(6);
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
