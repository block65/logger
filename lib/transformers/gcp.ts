import { serializeError } from 'serialize-error';
import type { JsonPrimitive } from 'type-fest';
import {
  Level,
  type LogData,
  type LogDescriptor,
  type PlainTransformer,
} from '../logger.js';
import { gcpErrorProcessor } from '../processors/gcp.js';
import { safeStringify, withNullProto } from '../utils.js';

type GcpSeverities = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type GcpJsonLogFormat = {
  severity: GcpSeverities;
  time: string;
  message?: JsonPrimitive;
  ctx?: LogData;
} & LogData;

const logLevelGcpSeverityMap = new Map<Level, GcpSeverities>([
  [Level.Trace, 'DEBUG'],
  [Level.Debug, 'DEBUG'],
  [Level.Info, 'INFO'],
  [Level.Warn, 'WARNING'],
  [Level.Error, 'ERROR'],
  [Level.Fatal, 'CRITICAL'],
]);

export const gcpTransformer: PlainTransformer = (
  log: LogDescriptor,
): string => {
  const { level, time, ctx, data = {}, msg } = gcpErrorProcessor(log);

  const { err, ...dataRest } = data;

  // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
  const jsonLog: GcpJsonLogFormat = withNullProto({
    severity: logLevelGcpSeverityMap.get(level) || 'INFO',
    time: time.toISOString(),
    ...(msg && { message: msg }),
    ...dataRest,
    ...(!!err && {
      err: err instanceof Error ? serializeError(err) : Object(err),
    }),
    ...(ctx && { ctx }),
  });

  return `${safeStringify(jsonLog)}\n`;
};
