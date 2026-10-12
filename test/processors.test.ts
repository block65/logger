import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from 'vitest';
import { createLoggerWithWaitableMock } from './helpers.ts';

describe('Processsors', () => {
  beforeEach(() => {
      });

  afterEach(() => {
    vi.useRealTimers();
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
