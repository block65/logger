import type { JsonObject } from 'type-fest';
import { LogDescriptor } from '../logger.js';
import { withNullProto } from '../utils.js';

// const levelToStringMap = new Map<Level, string>([
//   [Level.Trace, 'trace'],
//   [Level.Debug, 'debug'],
//   [Level.Info, 'info'],
//   [Level.Warn, 'warn'],
//   [Level.Error, 'error'],
//   [Level.Fatal, 'fatal'],
// ]);

export interface JsonLogFormat extends JsonObject {
  level: number;
  time: string;
  msg?: string;
  ctx?: JsonObject;
}

export const jsonTransformer = (log: LogDescriptor): string => {
  const { level, time, ctx, data, msg } = log;

  const jsonLog: JsonLogFormat = withNullProto({
    level,
    time: time.toISOString(),
    msg,
    ...data,
    ctx,
  });

  return JSON.stringify(jsonLog);
};
