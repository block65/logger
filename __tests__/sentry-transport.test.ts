import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import * as sentryModule from '@sentry/node';
import { LogLevelNumbers } from '../lib/types.js';

const captureException = jest.fn((exception, captureContext) => {
  return 'yes';
});

const captureMessage = jest.fn((message, captureContext) => {
  return 'yes';
});

jest.unstable_mockModule('@sentry/node', () => {
  return {
    ...sentryModule,
    captureException,
    captureMessage,
  };
});

describe('Sentry Transport', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('captureException arguments', async () => {
    const { default: sentryTransport } = await import(
      '../lib/sentry-transport.js'
    );
    const { writeLogsToStream } = await import('./helpers.js');

    const transport = sentryTransport({
      dsn: 'welp',
      context: {
        user: {
          id: '1234',
        },
        tags: {
          admin: true,
        },
      },
    });

    const mockFn = jest.fn();
    transport.on('data', mockFn);

    const fakeError = new Error('Fake');

    await writeLogsToStream(transport, {
      level: LogLevelNumbers.Fatal,
      time: Date.now(),
      err: {
        message: fakeError.message,
        stack: fakeError.stack,
      },
    });

    // await new Promise(setImmediate);

    expect(captureException).toBeCalledTimes(1);

    expect(captureException.mock.calls).toMatchSnapshot();
  });
});
