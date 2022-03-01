import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as sentryModule from '@sentry/node';
import { LogLevelNumbers } from '../lib/types.js';
import { writeLogsToStream } from './helpers.js';

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
    jest.clearAllMocks();
  });

  test('captureException arguments', async () => {
    const { default: sentryTransport } = await import(
      '../lib/sentry-transport.js'
    );

    const transport = await sentryTransport({
      dsn: 'welp',
    });

    const fakeError = new Error('Fake');

    await writeLogsToStream(transport, {
      level: LogLevelNumbers.Fatal,
      time: Date.now(),
      err: {
        message: fakeError.message,
        stack: fakeError.stack,
      },
    });

    expect(captureException.mock.calls).toMatchSnapshot();
  });
});
