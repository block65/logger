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
