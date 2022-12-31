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
  const initialEnv = process.env;
  beforeEach(() => {
    // jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterEach(() => {
    process.env = { ...initialEnv };
    jest.useRealTimers();
  });

  test('Cloud Run', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    await expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Cloud Run variant', async () => {
    process.env.VERSION_NAME = 'logger@foodfacecafe';
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    await expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Cloud Run Error Object', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.error(new Error('Ded 1'));
    await logger.end();

    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Cloud Run Fatal with Error Object', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.fatal(new Error('Ded 2'));
    await logger.end();

    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
