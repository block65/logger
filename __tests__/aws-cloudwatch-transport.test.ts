import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { cloudwatchTransport } from '../lib/transports/aws-cloudwatch.js';
import { LogLevelNumbers } from '../lib/types.js';
import { generateTmpFilenameAndReader, writeLogsToStream } from './helpers.js';

describe('AWS Cloudwatch', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date('2009-02-13T23:31:30.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Transport', async () => {
    const [dest, getLogs] = await generateTmpFilenameAndReader();
    const transport = await cloudwatchTransport({ dest });

    writeLogsToStream(
      transport,
      {
        level: LogLevelNumbers.Trace,
        time: Date.now(),
        msg: 'trace',
        random: {
          bool: true,
          str: 'hello',
          number: 12,
          arr: [1, 2, 3],
        },
      },
      {
        level: LogLevelNumbers.Debug,
        time: Date.now(),
        msg: 'Debug',
      },
      {
        level: LogLevelNumbers.Info,
        time: Date.now(),
        msg: 'Info',
      },
      {
        level: LogLevelNumbers.Warn,
        time: Date.now(),
        msg: 'Warn',
      },
      {
        level: LogLevelNumbers.Error,
        time: Date.now(),
        msg: 'Error',
        err: {
          stack: ['stuff', 'code'],
        },
      },
      {
        level: LogLevelNumbers.Fatal,
        time: Date.now(),
        msg: 'Fatal',
        err: {
          stack: ['stuff', 'code'],
        },
      },
    );

    await expect(getLogs()).resolves.toMatchSnapshot();
  });
});
