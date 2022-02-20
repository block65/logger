import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createPrettifier } from '../lib/pretty-transport.js';

describe('Prettifier', () => {
  jest.useRealTimers();

  const oldEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
  });

  test('No Color', async () => {
    process.env.NO_COLOR = 'true';

    const m = await import('../lib/pretty-transport.js');

    const prettifier = m.createPrettifier();

    expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
      }),
    ).toMatchSnapshot();

    expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
        random: {
          bool: true,
          str: 'hello',
          number: 12,
          arr: [1, 2, 3],
        },
      }),
    ).toMatchSnapshot();
  });

  test('With colour', async () => {
    const m = await import('../lib/pretty-transport.js');

    const prettifier = m.createPrettifier({
      color: true,
    });

    expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
      }),
    ).toMatchSnapshot();

    expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
        random: {
          bool: true,
          str: 'hello',
          number: 12,
          arr: [1, 2, 3],
        },
      }),
    ).toMatchSnapshot();
  });

  test('No colour on non tty fd', async () => {
    const prettifier = createPrettifier({
      fd: 1337,
    });

    expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
        random: {
          bool: true,
          str: 'hello',
          number: 12,
          arr: [1, 2, 3],
        },
      }),
    ).toMatchSnapshot();
  });
});
