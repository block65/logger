import { testLogger } from './helpers';

describe('Basic', () => {
  jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('Object', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  // test('Object with undefined props', async () => {
  //   const [logger, logPromise] = testLogger();
  //   logger.warn({ omg: undefined });
  //   await expect(logPromise).resolves.toMatchSnapshot();
  // });

  test('String, Object', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn('hello', { omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('String Format, Object', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn('hello %o', { omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true }, 'hello %s', 'world');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object, String Format, String', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true }, 'hello %s:%s %d', 'world', 'and', 123);
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true }, 'hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Trace Caller Auto (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, logPromise] = testLogger();
    logger.warn('hello');
    await expect(logPromise).resolves.toHaveProperty('caller');
  });

  test('Trace Caller Auto (production)', async () => {
    process.env.NODE_ENV = 'production';
    const [logger, logPromise] = testLogger();
    logger.warn('hello');
    await expect(logPromise).resolves.not.toHaveProperty('caller');
  });

  test('Trace Caller Force (production)', async () => {
    process.env.NODE_ENV = 'production';
    const [logger, logPromise] = testLogger({
      traceCaller: true,
    });
    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Trace Caller Force (development)', async () => {
    process.env.NODE_ENV = 'development';
    const [logger, logPromise] = testLogger({
      traceCaller: false,
    });
    logger.warn('hello');
    await expect(logPromise).resolves.not.toHaveProperty('caller');
  });

  test('Mixins basic + accum', async () => {
    const [logger, logPromise] = testLogger({
      mixins: [
        () => ({
          logger: {
            go: 'log',
          },
        }),
        () => ({
          luger: {
            go: 'bang',
          },
        }),
        (accum) => ({
          accum,
        }),
      ],
    });
    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Mixins property overwrite', async () => {
    const [logger, logPromise] = testLogger({
      mixins: [
        () => ({
          logger: {
            go: 'log',
          },
        }),
        () => ({
          logger: {
            go: 'brrr',
          },
        }),
      ],
    });
    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });
});
