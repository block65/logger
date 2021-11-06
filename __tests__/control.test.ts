import { describe, expect, test } from '@jest/globals';
import { vanillaLoggerWithWaitableMock } from './helpers.js';

describe('Control', () => {
  test('Error Object', async () => {
    const [logger, callback] = vanillaLoggerWithWaitableMock();
    logger.error(Object.assign(new Error('hallo'), { debug: 'wooyeah' }));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Error Object serialized on non-error level', async () => {
    const [logger, callback] = vanillaLoggerWithWaitableMock();
    logger.info(new Error('hallo'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('high velocity doesnt crash', async () => {
    const [logger, callback] = vanillaLoggerWithWaitableMock();

    const arr = Array.from(Array(100000), (_, idx) => idx);
    for await (const i of arr) {
      logger.info({ i }, 'hallo %d', i);
    }

    await callback.waitUntilCalledTimes(100000);
  });
});
