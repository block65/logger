import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

describe('CLI', () => {
  const initialEnv = process.env;
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  test('force-color on', async () => {
    const { Level, Logger } = await import('../lib/logger.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const logger = new Logger({
      transformer: createCliTransformer({ color: true }),
      destination: process.stdout,
      level: Level.Trace,
    });

    // @ts-ignore
    const callback = jest.spyOn(console._stdout, 'write').mockImplementation();

    logger.fatal(new Error('herp'));
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await logger.flush();

    expect(callback).toHaveBeenCalledTimes(6);
    expect(callback.mock.calls).toMatchSnapshot();

    callback.mockRestore();
  });

  test('force-color off', async () => {
    const { Level, Logger } = await import('../lib/logger.js');
    const { createCliTransformer } = await import('../lib/transformers/cli.js');

    const logger = new Logger({
      transformer: createCliTransformer({ color: false }),
      destination: process.stdout,
      level: Level.Trace,
    });

    // @ts-ignore
    const callback = jest.spyOn(console._stdout, 'write').mockImplementation();

    logger.fatal(new Error('herp'));
    logger.error(new Error('hallo'));
    logger.info(new Error('hello'));
    logger.warn(new Error('halo'));
    logger.debug(new Error('gday'));
    logger.trace(new Error('nihao3'));

    await logger.flush();

    expect(callback).toHaveBeenCalledTimes(6);
    expect(callback.mock.calls).toMatchSnapshot();

    callback.mockRestore();
  });
});
