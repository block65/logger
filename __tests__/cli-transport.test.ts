import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { LogLevelNumbers } from '../lib/types.js';
import { generateTmpFilenameAndReader, writeLogsToStream } from './helpers.js';

describe('Pretty Transport', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('cli logger', async () => {
    const { cliTransport } = await import('../lib/transports/cli.js');

    const [dest, getLogs] = await generateTmpFilenameAndReader();
    const transport = await cliTransport({ dest });

    await writeLogsToStream(
      transport,
      {
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
      },
      {
        level: LogLevelNumbers.Error,
        time: Date.now(),
        msg: 'Kaboom',
        stack: ['stuff', 'code'],
      },
    );

    expect(getLogs()).resolves.toMatchSnapshot();
  });
  test('cli logger force no-color', async () => {
    process.env.NO_COLOR = 'true';
    const { cliTransport } = await import('../lib/transports/cli.js');

    const [dest, getLogs] = await generateTmpFilenameAndReader();
    const transport = await cliTransport({ dest });

    await writeLogsToStream(
      transport,
      {
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
      },
      {
        level: LogLevelNumbers.Error,
        time: Date.now(),
        msg: 'Kaboom',
        stack: ['stuff', 'code'],
      },
    );

    expect(getLogs()).resolves.toMatchSnapshot();
  });

  test('cli logger force-color', async () => {
    const { cliTransport } = await import('../lib/transports/cli.js');

    const [dest, getLogs] = await generateTmpFilenameAndReader();

    const transport = await cliTransport({
      dest,
      color: true,
    });

    await writeLogsToStream(
      transport,
      {
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
      },
      {
        level: LogLevelNumbers.Error,
        time: Date.now(),
        msg: 'Kaboom',
        stack: ['stuff', 'code'],
      },
    );

    expect(getLogs()).resolves.toMatchSnapshot();
  });
});
