/* eslint-env jest */

Object.defineProperty(process, 'pid', {
  get: () => 1337,
  configurable: false,
});

jest.unstable_mockModule('node:os', () => {
  const actual = jest.requireActual('node:os');
  return {
    ...actual,
    hostname: jest.fn(() => 'testhost'),
  };
});
