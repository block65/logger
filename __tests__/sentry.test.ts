import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import * as sentryModule from '@sentry/node';
import { PassThrough } from 'stream';

const captureException = jest.fn((/* exception, captureContext */) => {
  return 'yes';
});

const captureMessage = jest.fn((/* message, captureContext */) => {
  return 'yes';
});

const flush = jest.fn((/* message, captureContext */) => {
  return 'yes';
});

jest.unstable_mockModule('@sentry/node', () => {
  return {
    ...sentryModule,
    flush,
    captureException,
    captureMessage,
  };
});

describe('Sentry processor', () => {
  beforeEach(() => {
    // jest.resetModules();
    jest.resetAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('module', async () => {
    const { Level } = await import('../lib/logger.js');

    const { createSentryProcessor } = await import(
      '../lib/processors/sentry.js'
    );

    const processor = createSentryProcessor({
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    await processor({
      level: Level.Error,
      time: new Date(),
      err: new Error('Oh its a fake error'),
    });

    expect(captureException).toBeCalledTimes(1);
    expect(flush).toBeCalledTimes(0);

    expect(captureException.mock.calls).toMatchSnapshot();
  });

  test('integrated', async () => {
    const { Level, Logger } = await import('../lib/logger.js');
    const { createSentryProcessor } = await import(
      '../lib/processors/sentry.js'
    );

    const logger = new Logger({
      destination: new PassThrough({ objectMode: true }),
      level: Level.Info,
      processors: [createSentryProcessor()],
    });

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.flush();

    expect(flush).toBeCalledTimes(0);
    expect(captureException).toBeCalledTimes(3);
    expect(captureException.mock.calls).toMatchSnapshot();
  });

  test('processor attached', async () => {
    const { createSentryProcessor } = await import(
      '../lib/processors/sentry.js'
    );
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, getLogs] = createLoggerWithWaitableMock({
      // sentryTransportOptions: {
      //   minLogLevel: 'error',
      // },
      processors: [createSentryProcessor()],
    });

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.flush();

    expect(getLogs.mock.calls).toHaveLength(3);

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(6);
    expect(getLogs.mock.calls).toMatchSnapshot();
  });
});
