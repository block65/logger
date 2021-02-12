import { testLogger } from './helpers';

describe('Basic', () => {
  jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));

  test('Object', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object + String', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn('hello', { omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn('hello %o', { omg: true });
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Object + String = Format', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn({ omg: true }, 'hello');
    await expect(logPromise).resolves.toMatchSnapshot();
  });

  test('Plain logger, no context', async () => {
    const [logger, logPromise] = testLogger();
    logger.warn('hello');
    await expect(logPromise).resolves.toMatchSnapshot();
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
