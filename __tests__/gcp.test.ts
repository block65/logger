import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { gcpErrorProcessor } from '../lib/processors/gcp.js';
import { createLoggerWithWaitableMock } from './helpers.js';

describe('GCP Processor', () => {
  const oldEnv = process.env;
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    process.env = { ...oldEnv };
    jest.useRealTimers();
  });

  test('Cloud Run', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    await expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Cloud Run variant', async () => {
    process.env.VERSION_NAME = 'logger@foodfacecafe';
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    await expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Cloud Run Error Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.error(new Error('Ded 1'));
    await logger.end();

    await expect(callback.mock.calls).toMatchSnapshot();
  });

  test('Cloud Run Fatal with Error Object', async () => {
    const [logger, callback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.fatal(new Error(`Ded 2`));
    await logger.end();

    await expect(callback.mock.calls).toMatchSnapshot();
  });
});
