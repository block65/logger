import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createCliTransformer } from '../lib/index.js';

describe('Child Logger', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('Basic', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback] = createLoggerWithWaitableMock();

    const childLogger = logger.child({ helloChildLogger: 'hello!' });

    childLogger.error(new Error('hallo'));
    childLogger.info(new Error('hello'));
    childLogger.warn(new Error('halo'));
    childLogger.debug(new Error('gday'));
    childLogger.trace(new Error('nihao2'));
    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
  });

  test('with context + cli', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.js');

    const [logger, callback] = createLoggerWithWaitableMock({
      transformer: createCliTransformer(),
    });

    const childLogger = logger.child(
      { helloChildLogger: 'hello!' },
      {
        context: { name: 'CHILDLOGGER' },
      },
    );

    childLogger.error(new Error('hallo'));
    childLogger.info(new Error('hello'));
    childLogger.warn(new Error('halo'));
    childLogger.debug(new Error('gday'));
    childLogger.trace(new Error('nihao2'));
    await expect(callback.waitUntilCalledTimes(5)).resolves.toMatchSnapshot();
  });
});
