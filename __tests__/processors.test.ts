import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('Processsors', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Crashy', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [
        () => {
          throw new Error('oops I crashed');
        },
      ],
    });

    logger.error('I sure hope this doesnt crash');

    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();

    expect(errback).toBeCalled();
    expect(errback.mock.calls).toMatchSnapshot();
  });
});
