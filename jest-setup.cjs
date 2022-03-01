/* eslint-env jest */

Object.defineProperty(process, 'pid', {
  get: () => 1337,
  configurable: false,
});

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    hostname: jest.fn(() => 'testhost'),
  };
});
