import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { FileHandle, open, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TextDecoder } from 'node:util';
import { LogLevelNumbers } from '../lib/types.js';
import { createTmpLogfileDest, writeLogsToStream } from './helpers.js';

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

  test('pretty logger no-color', async () => {
    process.env.NO_COLOR = 'true';
    const { prettyTransport } = await import('../lib/pretty-transport.js');

    const [destination, getLogs] = await createTmpLogfileDest();
    const transport = await prettyTransport({ destination });

    await writeLogsToStream(transport, {
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

    const logs = await getLogs();

    expect(logs).toMatchSnapshot();
  });

  test('pretty logger force-color', async () => {
    const { prettyTransport } = await import('../lib/pretty-transport.js');

    const [destination, getLogs] = await createTmpLogfileDest();

    const transport = await prettyTransport({
      destination,
      color: true,
    });

    await writeLogsToStream(transport, {
      level: LogLevelNumbers.Error,
      err: {
        message: 'hello',
      },
      time: Date.now(),
    });
    const logs = await getLogs();

    expect(logs).toMatchSnapshot();
  });
});
