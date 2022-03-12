import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import * as sentryModule from '@sentry/node';
import { Writable } from 'node:stream';
import { LogLevelNumbers } from '../lib/types.js';
import { createLoggerWithTmpfileDestinationJson } from './helpers.js';

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

const streamWaiter = (stream: Writable) => {
  const waiter = new Promise((resolve, reject) => {
    stream.on('end', resolve).on('error', reject);
  });

  return async () => {
    stream.end();
    await waiter;
  };
};

describe('Sentry ', () => {
  beforeEach(() => {
    // jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Transport', async () => {
    const { sentryTransport } = await import('../lib/transports/sentry.js');
    const { writeLogsToStream } = await import('./helpers.js');

    const transport = sentryTransport({
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    const streamEnder = streamWaiter(transport);

    writeLogsToStream(transport, {
      level: LogLevelNumbers.Error,
      time: Date.now(),
      err: {
        message: 'Oh its a fake error',
        stack: new Error('Fake').stack,
      },
    });

    await streamEnder();

    expect(captureException).toBeCalledTimes(1);
    // expect(flush).toBeCalledTimes(1);

    expect(captureException.mock.calls).toMatchSnapshot();
  });

  test('Logger', async () => {
    const [logger, getLogs] = await createLoggerWithTmpfileDestinationJson({
      sentryTransportOptions: {
        minLogLevel: 'error',
      },
    });

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.flushTransports();

    const before = await getLogs();
    expect(before).toHaveLength(3);

    logger.error(new Error('fake'));
    logger.error(new Error('fake'));
    logger.error(new Error('fake'));

    await logger.flushTransports();

    const after = await getLogs();
    expect(after).toHaveLength(6);
    expect(after).toMatchSnapshot();
  });
});
