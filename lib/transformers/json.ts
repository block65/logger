import { serializeError } from 'serialize-error';
import type { JsonPrimitive } from 'type-fest';
import type { JsonifiableObject } from 'type-fest/source/jsonifiable.js';
import type { LogData, LogDescriptor, PlainTransformer } from '../logger.js';
import { safeStringify, withNullProto } from '../utils.js';

// const levelToStringMap = new Map<Level, string>([
//   [Level.Trace, 'trace'],
//   [Level.Debug, 'debug'],
//   [Level.Info, 'info'],
//   [Level.Warn, 'warn'],
//   [Level.Error, 'error'],
//   [Level.Fatal, 'fatal'],
// ]);

interface LogFormat {
  level: number;
  time: string;
  msg?: JsonPrimitive;
  ctx?: LogData;
}

export type JsonLogFormat = JsonifiableObject & LogFormat;

export const jsonTransformer: PlainTransformer = (
  log: LogDescriptor,
): string => {
  const { level, time, ctx, data = {}, msg } = log;

  const { err, ...dataRest } = data;

  const jsonLog: JsonLogFormat = withNullProto({
    level,
    time: time.toISOString(),
    ...(msg && { msg }),
    ...dataRest,
    ...(!!err && {
      error: err instanceof Error ? serializeError(err) : Object(err),
    }),
    ...(ctx && { ctx }),
  });

  return `${safeStringify(jsonLog)}\n`;
};
