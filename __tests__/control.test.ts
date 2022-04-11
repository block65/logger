import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('Control', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Error Object', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.error(Object.assign(new Error('hallo'), { debug: 'wooyeah' }));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Error Object serialized on non-error level', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const [logger, callback, errback] = createLoggerWithWaitableMock();
    logger.info(new Error('hallo'));
    await expect(callback.waitUntilCalled()).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('high velocity doesnt crash', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const [logger, callback, errback] = createLoggerWithWaitableMock();

    const arr = Array.from(Array(100000), (_, idx) => idx);
    // eslint-disable-next-line no-restricted-syntax
    for await (const i of arr) {
      logger.info({ i }, 'hallo %d', i);
    }

    await callback.waitUntilCalledTimes(100000);
    expect(errback).not.toBeCalled();
  });
});
