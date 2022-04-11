import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('CLI', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('no-color', async () => {
    process.env.NO_COLOR = 'true';

    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const transformer = createCliTransformer();

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      transformer,
    });
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao2'));
    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('force-color', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const transformer = createCliTransformer({
      color: true,
    });

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      transformer,
    });

    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
