import { captureException, flush, Severity } from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import { Level, LogDescriptor, Logger } from '../logger.js';

export interface SentryListenerOptions {
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
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
  options: SentryListenerOptions,
) {
  const context: Partial<ScopeContext> = {
    level: sentrySeverityMap.get(log.level) || Severity.Log,
    ...options.context,
  };

  captureException(log.err, context);
}

export function createSentryListener(options: SentryListenerOptions = {}) {
  return (log: LogDescriptor): void => {
    if (log.level >= Level.Error && log.err) {
      sentryCaptureLog(log, options);
    }
  };
}

export function attachSentryListener(
  logger: Logger,
  options: SentryListenerOptions = {},
): Logger {
  const listener = createSentryListener(options);

  logger.on('log', listener);
  logger.on('flush', async () => {
    await flush(1000);
  });
  return logger;
}
