import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from 'vitest';
import { gcpErrorProcessor } from '../lib/processors/gcp.ts';
import { createLoggerWithWaitableMock } from './helpers.ts';

describe('GCP Processor', () => {
  const initialEnv = process.env;

  afterEach(() => {
    process.env = { ...initialEnv };
    vi.useRealTimers();
  });

  test('Cloud Run', async () => {
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });

  test('Cloud Run variant', async () => {
    process.env.VERSION_NAME = 'logger@foodfacecafe';
    const [logger, callback, errback] = createLoggerWithWaitableMock({
      processors: [gcpErrorProcessor],
    });

    logger.warn(new Error('hello'));
    await logger.end();
    expect(callback.mock.calls).toMatchSnapshot();
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
