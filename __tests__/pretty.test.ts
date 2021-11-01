import { describe, test, expect } from '@jest/globals';
import { createPrettifier } from '../lib/prettifier.js';

describe('Prettifier', () => {
  test('via createPrettifier', async () => {
    const prettifier = createPrettifier();
    await expect(
      prettifier({
        level: 20,
        pid: 1,
        time: 1234567890,
        hostname: 'test',
      }),
    ).toMatchSnapshot();

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

  // test('via import', async () => {
  //   // NOTE: All we can do here is make sure this doesn't throw.
  //   // It's not possible to test via Jest because we can't provide both a
  //   // transport AND a stream and because transports are just modules, all we
  //   // can do is mock it, which defeats the purpose of testing it
  //
  //   const { createLogger } = await import('../dist/index.js');
  //
  //   const logger = createLogger({
  //     pretty: true,
  //   });
  //
  //   logger.trace({
  //     test: 123,
  //   });
  // });
});
