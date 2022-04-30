import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createCliTransformer, Level } from '../lib/index.js';

describe('Child Logger', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('Basic', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback, errback] = createLoggerWithWaitableMock();

    const childLogger = logger.child({ helloChildLogger: 'hello!' });

    childLogger.fatal(new Error('fatal'));
    childLogger.error(new Error('error'));
    childLogger.info(new Error('info'));
    childLogger.warn(new Error('warn'));
    childLogger.debug(new Error('debug'));
    childLogger.trace(new Error('trace'));
    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('with context + cli', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      transformer: createCliTransformer(),
    });

    const childLogger = logger.child(
      { helloChildLogger: 'hello!' },
      {
        context: { name: 'CHILDLOGGER' },
      },
    );

    childLogger.fatal(new Error('fatal'));
    childLogger.error(new Error('error'));
    childLogger.info(new Error('info'));
    childLogger.warn(new Error('warn'));
    childLogger.debug(new Error('debug'));
    childLogger.trace(new Error('trace'));
    await expect(callback.waitUntilCalledTimes(6)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('level changes parent > child', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      level: Level.Fatal,
    });

    const childLogger = logger.child(
      { helloChildLogger: 'hello!' },
      {
        level: Level.Trace,
      },
    );

    childLogger.fatal(new Error('fatal'));
    childLogger.error(new Error('error'));
    childLogger.info(new Error('info'));
    childLogger.warn(new Error('warn'));
    childLogger.debug(new Error('debug'));
    childLogger.trace(new Error('trace'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('level changes child > parent', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      level: Level.Trace,
    });

    const childLogger = logger.child(
      { helloChildLogger: 'hello!' },
      {
        level: Level.Fatal,
      },
    );

    childLogger.fatal(new Error('fatal'));
    childLogger.error(new Error('error'));
    childLogger.info(new Error('info'));
    childLogger.warn(new Error('warn'));
    childLogger.debug(new Error('debug'));
    childLogger.trace(new Error('trace'));
    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

});
