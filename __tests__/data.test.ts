import {
  afterAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

function newError(msg: string): Error {
  const err = new Error(msg);
  err.stack = `${err.name}\n    at fake.js:0:0`;
  return err;
}

describe('Data', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: new Date('2009-02-13T23:31:30.000Z') });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const bigOlSetOfTypes = [
    'string',
    123,
    false,
    Symbol(123),
    { [Symbol('234')]: 'symbol as key' },
    Object.freeze({ frozen: 123 }),
    newError('test'),
    null,
    undefined,
    BigInt(1),
    Buffer.from([]),
    { message: 'test' },
    { err: null },
    { err: newError('err prop') },
  ];

  const randomArgumentSet: (typeof bigOlSetOfTypes)[] = [];

  bigOlSetOfTypes.forEach((arg, idx, arr) => {
    randomArgumentSet.push([arg, ...arr.filter((v) => v !== arg)]);
  });

  test.each(randomArgumentSet)(
    '%# argdddds [%o,%o,%o,%o] does not crash',
    async (...args: unknown[]) => {
      const { createLoggerWithWaitableMock } = await import('./helpers.js');

      const [logger, callback, errback] = createLoggerWithWaitableMock();
      // @ts-ignore;
      logger.fatal(...args);
      await logger.end();

      expect(callback.mock.calls).toMatchSnapshot();
      expect(errback).not.toBeCalled();
    },
  );
});
