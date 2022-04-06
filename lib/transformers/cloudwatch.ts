import { LogDescriptor, Level } from '../logger.js';
import { isEmptyObject, stringifyUndefined } from '../utils.js';

// https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/c31c41ffe5f2f03ae9e8589b96f3b005e2bb8a4a/src/utils/LogPatch.ts#L10
type AwsLevelNames = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

const levelNumberToCloudwatchStringMap = new Map<Level, AwsLevelNames>([
  [Level.Fatal, 'FATAL'],
  [Level.Error, 'ERROR'],
  [Level.Warn, 'WARN'],
  [Level.Info, 'INFO'],
  [Level.Debug, 'DEBUG'],
  [Level.Trace, 'TRACE'],
  [Level.Silent, 'TRACE'],
]);

export function createCloudwatchTransformer(/* options = {} */) {
  return (log: LogDescriptor): string => {
    const { level, msg, ctx, time, data } = log;

    const { id: contextId, ...contextRest } = ctx || {};

    const rest = { level, ...(data && { data }) };

    const restStr = JSON.stringify({
      ...stringifyUndefined(rest),
      ...(contextRest && !isEmptyObject(contextRest) && { ctx: contextRest }),
    });

    return [
      new Date(time).toISOString(),
      contextId,
      levelNumberToCloudwatchStringMap.get(level),
      msg || '',
      restStr,
    ].join('\t');
  };
}
