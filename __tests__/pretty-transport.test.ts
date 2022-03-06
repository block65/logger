import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LogLevelNumbers } from '../lib/types.js';
import { writeLogsToStream } from './helpers.js';

describe('Pretty Transport', () => {
  const oldEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
    process.env = { ...oldEnv };
  });

  test('pretty logger no-color', async () => {
    process.env.NO_COLOR = 'true';
    const { prettyTransport } = await import('../lib/pretty-transport.js');
    const transport = await prettyTransport();

    const mockFn = jest.fn();
    transport.on('data', mockFn);

    writeLogsToStream(transport, {
      level: LogLevelNumbers.Info,
      time: Date.now(),
      pid: 1,
      hostname: 'test',
      msg: 'kek',
      random: {
        bool: true,
        str: 'hello',
        number: 12,
        arr: [1, 2, 3],
      },
    });

    await expect(mockFn.mock.calls).resolves.toMatchSnapshot();
  });

  test('pretty logger force-color', async () => {
    process.env.NO_COLOR = 'true';
    const { prettyTransport } = await import('../lib/pretty-transport.js');
    const transport = await prettyTransport({
      color: true,
    });

    const mockFn = jest.fn();
    transport.on('data', mockFn);

    writeLogsToStream(transport, {
      level: LogLevelNumbers.Error,
      err: {
        message: 'Error: hello',
      },
      time: Date.now(),
    });

    await expect(mockFn.mock.calls).resolves.toMatchSnapshot();
  });
});
