import fastRedact, { type RedactOptions } from 'fast-redact';
import { Processor } from '../logger.js';

export function createRedactProcessor(
  options: Omit<RedactOptions, 'serialize'>,
): Processor {
  const redact = fastRedact({
    ...options,
    serialize: false,
  });

  return (log) => ({
    ...log,
    data: Object(redact(log.data)),
  });
}
