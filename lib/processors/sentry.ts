import { captureException, flush, Severity } from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import { Processor, LogDescriptor, Level, Logger } from '../logger.js';

export interface SentryTransportOptions {
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
  minLogLevel?: any;
}

const sentrySeverityMap = new Map<Level, Severity>([
  [Level.Fatal, Severity.Fatal],
  [Level.Error, Severity.Error],
  [Level.Warn, Severity.Warning],
  [Level.Info, Severity.Info],
  [Level.Debug, Severity.Debug],
  [Level.Trace, Severity.Debug],
]);

export function sentryCaptureLog(
  log: LogDescriptor,
  options: SentryTransportOptions,
) {
  const context: Partial<ScopeContext> = {
    level: sentrySeverityMap.get(log.level) || Severity.Log,
    ...options.context,
  };

  captureException(log.err, context);
}

export function createSentryProcessor(
  options: SentryTransportOptions = {},
): Processor {
  return (log) => {
    sentryCaptureLog(log, options);
    return log;
  };
}

export function attachSentryProcessor(
  logger: Logger,
  options: SentryTransportOptions = {},
): Logger {
  logger.on('log', (log) => sentryCaptureLog(log, options));
  logger.on('flush', async () => {
    await flush(1000);
  });
  return logger;
}
