import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { LogDescriptor, LogLevelNumbers } from '../types.js';
import { stringifyUndefined } from '../utils.js';

// must be serialiazable so it can get passed to a worker
export interface CloudwatchTransportOptions extends SonicBoomOpts {}

// https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/c31c41ffe5f2f03ae9e8589b96f3b005e2bb8a4a/src/utils/LogPatch.ts#L10
type AWsLevelNames = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

const levelNumberToCloudwatchStringMap = new Map<
  LogLevelNumbers,
  AWsLevelNames
>([
  [LogLevelNumbers.Fatal, 'FATAL'],
  [LogLevelNumbers.Error, 'ERROR'],
  [LogLevelNumbers.Warn, 'WARN'],
  [LogLevelNumbers.Info, 'INFO'],
  [LogLevelNumbers.Debug, 'DEBUG'],
  [LogLevelNumbers.Trace, 'TRACE'],
  [LogLevelNumbers.Silent, 'TRACE'],
]);

function createCloudwatchTransformer() {
  return (log: LogDescriptor): string => {
    const {
      msg,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _contextId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _context,
      time,
      ...rest
    } = log;

    const restStr =
      Object.keys(rest).length > 0
        ? JSON.stringify({ ...stringifyUndefined(rest), ctx: _context })
        : '';

    return [
      new Date(time).toISOString(),
      _contextId || '',
      levelNumberToCloudwatchStringMap.get(log.level),
      msg || '',
      restStr,
    ].join('\t');
  };
}

export function cloudwatchTransport(options: CloudwatchTransportOptions = {}) {
  const transformer = createCloudwatchTransformer();

  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom(options);

  // await once(destination, 'ready');

  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const obj of source) {
        const toDrain = !destination.write(`${transformer(obj)}\n`);
        // This block will handle backpressure
        if (toDrain) {
          await once(destination, 'drain');
        }
      }
    },
    {
      async close(err?: Error) {
        if (err) {
          console.warn(err);
        }
        destination.end();

        await once(destination, 'close');
      },
    },
  );
}

export default cloudwatchTransport;
