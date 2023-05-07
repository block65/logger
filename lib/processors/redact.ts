import fastRedact, { type RedactOptions } from 'fast-redact';
import { type Processor } from '../logger.js';

export function createRedactProcessor(
  options: Omit<RedactOptions, 'serialize'>,
): Processor {
  const redact = fastRedact({
    ...options,
    serialize: false,
  });

  return (log) => {
    if (!log.data) {
      return log;
    }

    try {
      // redact types are wrong, it claims this could return a string.
      // but that is only when serialize is true
      const redacted = redact(log.data) as typeof log.data;

      return {
        ...log,
        data: redacted,
      };
    } catch (err) {
      // safely return no data if we failed to redact
      return {
        ...log,
        data: {
          LOG_REDACTOR_CRASH: Object(err).stack,
          // attempt a crash free way of listing the keys to help debug
          // without revealing sensitive data
          LOG_REDACTOR_CRASH_KEYS: Object.keys(Object(log.data)),
        },
      };
    }
  };
}
