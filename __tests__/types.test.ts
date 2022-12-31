import { TextEncoder } from 'util';
import { describe, test } from '@jest/globals';
import { createLoggerWithWaitableMock } from './helpers.js';

enum TestEnum {
  Test,
}

interface Stuff {
  stuff: 'things';
}

describe('Data', () => {
  test('types', async () => {
    const [logger] = createLoggerWithWaitableMock();

    const err: unknown = new Error();
    logger.info(err);

    logger.info('standard');
    logger.info('standard %s', 'stuff');
    logger.info({ obj: 123 }, 'standard %s', 'stuff');

    const msg = undefined;
    logger.info(msg, msg, msg);

    logger.info(null);
    logger.info(undefined);
    logger.info(null, null);
    logger.info(null, 'test');
    logger.info(null, 'test', null, undefined, false);

    const stuff: Stuff = {
      stuff: 'things',
    };

    logger.trace(stuff);

    logger.trace('URL is %s', new URL('https://example.com'));

    logger.trace('Date is %s', new Date());

    logger.trace({ obj: 123, err }, 'test %s', 123, undefined, err);

    logger.trace(TestEnum.Test);

    logger.trace(123);

    logger.trace(
      { expect: 'error' },
      'test',
      new TextEncoder().encode('some text'),
    );

    logger.trace([1, 2, 3]);

    logger.trace({ err: BigInt(1) }, 'whut?');

    // @ts-expect-error
    logger.trace({ expect: 'error' }, { dont: 'do this' });

    // @ts-expect-error
    logger.trace({ expect: 'error' }, new TextEncoder().encode('some text'));

    await logger.end();
  });
});
