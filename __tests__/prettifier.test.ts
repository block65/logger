import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createPrettifier } from '../lib/pretty-transport.js';

process.env.NO_COLOR = 'true';

describe('Prettifier', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  test('Color', async () => {
    process.env.NO_COLOR = 'true';

    const prettifier = createPrettifier();

    await expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
      }),
    ).toMatchSnapshot();

    await expect(
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
    process.env.FORCE_COLOR = 'true';

    const prettifier = createPrettifier();

    await expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
        msg: 'kek',
      }),
    ).toMatchSnapshot();

    await expect(
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
