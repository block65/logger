import { beforeEach, describe, expect, vi, test } from 'vitest';
import { jsonTransformer, Level } from '../lib/index.ts';
import { createCliTransformer } from '../lib/node.ts';

describe('Child Logger', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('Basic', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

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
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

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
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      level: Level.Fatal,
      context: { parent: 'test' },
    });

    const childLogger = logger.child(
      { extraChildData: 'hello!' },
      {
        level: Level.Trace,
        context: {
          extraChildContext: 'hello!',
        },
      },
    );

    // logger.on('log', console.error);

    logger.fatal('fatal');
    childLogger.fatal('fatal');
    childLogger.fatal('fatal');
    childLogger.error('error');
    childLogger.info('info');
    childLogger.warn('warn');
    childLogger.debug('debug');
    childLogger.trace('trace');

    await expect(callback.waitUntilCalledTimes(2)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  }, 10000);

  test('level changes child > parent', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

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

  test('child logger spam', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      level: Level.Trace,
    });

    const warningMock = vi.fn();

    process.on('warning', (err) => {
      console.warn(err);
      warningMock(err);
    });

    const iterations = 500;

    const autoEndMock = vi.fn(() => {});

    for (const childIndex of [...Array(iterations)].map((_, idx) => idx)) {
      const childLogger = logger.child({ childIndex });
      childLogger.info(new Error('hello'));
      childLogger.on('end', autoEndMock);
    }

    await logger.end();

    await callback.waitUntilCalledTimes(iterations);

    expect(errback).not.toBeCalled();
    expect(warningMock).not.toBeCalled();

    // make sure each child was ended
    expect(autoEndMock).toBeCalledTimes(iterations);
  }, 30000);

  test('Child message format', async () => {
    const { createLoggerWithWaitableMock } = await import('./helpers.ts');

    const [logger, callback, errback] = createLoggerWithWaitableMock({
      transformer: jsonTransformer,
    });

    const childLogger = logger.child({ helloChildLogger: 'hello!' });

    childLogger.fatal(
      { err: new Error(), woo: 'yeah' },
      'Time is an %s',
      'illusion',
    );

    await expect(callback.waitUntilCalledTimes(1)).resolves.toMatchSnapshot();
    expect(errback).not.toBeCalled();
  });
});
