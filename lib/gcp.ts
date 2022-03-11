import pino from 'pino';
import { isPlainObject } from './utils.js';

type GcpSeverities = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export const logLevelGcpSeverityMap = new Map<
  pino.Level | string,
  GcpSeverities
>([
  ['trace', 'DEBUG'],
  ['debug', 'DEBUG'],
  ['info', 'INFO'],
  ['warn', 'WARNING'],
  ['error', 'ERROR'],
  ['fatal', 'CRITICAL'],
]);

export function formatGcpLogObject(details: object): object {
  if (isPlainObject(details)) {
    if ('stack' in details) {
      const { stack, ...rest } = details;
      if (stack) {
        return {
          stack_trace: stack,
          ...rest,
        };
      }
    }

    if (
      ('err' in details && isPlainObject(details.err)) ||
      details.err instanceof Error
    ) {
      const { err, ...rest } = details;
      const { stack, ...restErr } = err;
      if (stack) {
        return {
          stack_trace: stack,
          ...rest,
          ...restErr,
        };
      }
    }
  }
  return details;
}
