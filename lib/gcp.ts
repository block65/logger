import { isPlainObject } from './utils.js';

export const gcpLevelToSeverity: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

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
