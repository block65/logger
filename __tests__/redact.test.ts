import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createRedactProcessor } from '../lib/index.js';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('Redact', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Basic', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [
        createRedactProcessor({
          censor: '🧱🧱🧱🧱',
          paths: ['secret'],
        }),
      ],
    });

    logger.error({ secret: 'trustno1' });
    logger.error('trustno1');

    await logger.flush();

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
