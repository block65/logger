import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('Control', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Error Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.error(Object.assign(new Error('hallo'), { debug: 'wooyeah' }));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('Error Object serialized on non-error level', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();
    logger.info(new Error('hallo'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
  });

  test('high velocity doesnt crash', async () => {
    const [logger, callback] = createLoggerWithWaitableMock();

    const arr = Array.from(Array(100000), (_, idx) => idx);
    // eslint-disable-next-line no-restricted-syntax
    for await (const i of arr) {
      logger.info({ i }, 'hallo %d', i);
    }

    await callback.waitUntilCalledTimes(100000);
  });
});
