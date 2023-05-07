import { Level, type PlainTransformer, type Transformer } from '../logger.js';
import { isEmptyObject, safeStringify, stringifyUndefined } from '../utils.js';

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

const cloudwatchTransformer: Transformer = function cloudwatchTransformer(log) {
  const { level, msg, ctx, time, data } = log;

  const { id: contextId = null, ...ctxRest } = { ...ctx };

  const dataStr = safeStringify({
    level,
    ...stringifyUndefined(data),
    ...(ctxRest && !isEmptyObject(ctxRest) && { ctx: ctxRest }),
  });

  const line = [
    time.toISOString(),
    contextId,
    levelNumberToCloudwatchStringMap.get(level),
    // the LF -> CR replacement is what happens in the AWS Lambda RIC
    (typeof msg !== 'undefined' ? String(msg) : '')
      .trim()
      .replaceAll(/\n/g, '\r'),
    dataStr,
  ].join('\t');

  return `${line}\n`;
};

export function createCloudwatchTransformer(/* options = {} */): PlainTransformer {
  return cloudwatchTransformer;
}
