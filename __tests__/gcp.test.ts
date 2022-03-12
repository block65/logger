import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createLoggerWithTmpfileDestinationJson } from './helpers.js';

describe('GCP', () => {
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Cloud Run', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
      logFormat: 'gcp',
    });

    logger.warn(new Error('hello'));
    await logger.flushTransports();
    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Cloud Run Error Object', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
      logFormat: 'gcp',
    });

    logger.error(new Error('Ded 1'));
    await logger.flushTransports();

    await expect(callback()).resolves.toMatchSnapshot();
  });

  test('Cloud Run Fatal with Error Object', async () => {
    const [logger, callback] = await createLoggerWithTmpfileDestinationJson({
      logFormat: 'gcp',
    });

    logger.fatal(new Error(`Ded 2`));
    await logger.flushTransports();

    await expect(callback()).resolves.toMatchSnapshot();
  });
});
