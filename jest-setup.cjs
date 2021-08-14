Object.defineProperty(process, 'pid', {
  get: () => 1337,
  configurable: false,
});

jest.useFakeTimers('modern');
jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    hostname: jest.fn(() => 'testhost'),
  };
});

// Ensures all envs are the same, GH Actions has some non-default setting
// needed because stack traces are part of the log metadata
Error.stackTraceLimit = 2;
