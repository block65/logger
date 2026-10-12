import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi,
  test,
} from 'vitest';
import { Level, type LogDescriptor } from '../lib/logger.ts';

describe('AWS Cloudwatch', () => {
  beforeEach(() => {
      });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('Transformer', async () => {
    const { createCloudwatchTransformer } = await import(
      '../lib/transformers/cloudwatch.ts'
    );

    const transformer = createCloudwatchTransformer();

    const logs: LogDescriptor[] = [
      {
        level: Level.Trace,
        time: new Date(),
        msg: 'This is a trace',
        data: {
          random: {
            bool: true,
            str: 'hello',
            number: 12,
            arr: [1, 2, 3],
          },
        },
      },
      {
        level: Level.Debug,
        time: new Date(),
        msg: 'This is debug',
      },
      {
        level: Level.Info,
        time: new Date(),
        msg: 'This is info',
      },
      {
        level: Level.Warn,
        time: new Date(),
        msg: 'This is a warning',
      },
      {
        level: Level.Error,
        time: new Date(),
        msg: 'Oh no an error',
        data: {
          err: {
            message: 'Error',
            type: 'Error',
            stack: 'stuff\ncode',
          },
        },
      },
      {
        level: Level.Fatal,
        time: new Date(),
        msg: 'OMG this is fatal',
        data: {
          err: {
            message: 'Error',
            type: 'Error',
            stack: 'stuff\ncode',
          },
        },
      },
      {
        level: Level.Trace,
        time: new Date(),
        msg: 'This\nmessage\ncontains\nnewlines\r\nyes\rit\rdoes\n',
      },
    ];

    expect(logs.map((log) => transformer(log))).toMatchSnapshot();
  });
});
