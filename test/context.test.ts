import { afterEach, describe, expect, test } from 'vitest';

describe('Context Wrapper', () => {
  const initialEnv = process.env;

  afterEach(() => {
    process.env = { ...initialEnv };
  });

  test('Basic', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      context: {
        name: 'CONTEXTNAME',
      },
    });

    logger.info('hello');

    await logger.end();

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
