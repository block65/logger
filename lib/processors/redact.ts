import fastRedact, { type RedactOptions } from 'fast-redact';
import { Processor } from '../logger.js';

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

    return {
      ...log,
      // redact types are wrong, it claims this could return a string.
      data: redact(log.data) as typeof log.data,
    };
  };
}
