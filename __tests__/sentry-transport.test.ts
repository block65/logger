import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import * as sentryModule from '@sentry/node';
import { Level } from '../lib/logger.js';
import { createLoggerWithWaitableMock } from './helpers.js';

const captureException = jest.fn((exception, captureContext) => {
  return 'yes';
});

const captureMessage = jest.fn((message, captureContext) => {
  return 'yes';
});

const flush = jest.fn((message, captureContext) => {
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

describe('Sentry ', () => {
  beforeEach(() => {
    // jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Decorator', async () => {
    const { sentryDecorator } = await import('../lib/decorators/sentry.js');

    const decorator = sentryDecorator({
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    await decorator({
      level: Level.Error,
      time: new Date(),
      data: {
        err: {
          message: 'Oh its a fake error',
          type: 'Error',
          stack: new Error('Oh its a fake error').stack,
        },
      },
    });

    expect(captureException).toBeCalledTimes(1);
    // expect(flush).toBeCalledTimes(1);

    expect(captureException.mock.calls).toMatchSnapshot();
  });

  test('Logger', async () => {
    const [logger, getLogs] = await createLoggerWithWaitableMock({
      // sentryTransportOptions: {
      //   minLogLevel: 'error',
      // },
    });

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(3);

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.end();

    expect(getLogs.mock.calls).toHaveLength(6);
    expect(getLogs.mock.calls).toMatchSnapshot();
  });
});
