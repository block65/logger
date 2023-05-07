import {
  addBreadcrumb,
  captureException,
  flush,
  type SeverityLevel,
} from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import { Level, type LogDescriptor, Logger } from '../logger.js';

export interface SentryListenerOptions {
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
}

const sentrySeverityMap = new Map<Level, SeverityLevel>([
  [Level.Fatal, 'fatal'],
  [Level.Error, 'error'],
  [Level.Warn, 'warning'],
  [Level.Info, 'info'],
  [Level.Debug, 'debug'],
  [Level.Trace, 'debug'],
]);

function sentryCaptureLog(log: LogDescriptor, options: SentryListenerOptions) {
  const context: Partial<ScopeContext> = {
    level: sentrySeverityMap.get(log.level) || 'log',
    ...options.context,
  };

  captureException(log.err, context);
}

export function createSentryListener(options: SentryListenerOptions = {}) {
  return (log: LogDescriptor): LogDescriptor => {
    if (log.level < Level.Error) {
      const message = log.msg?.toLocaleString();

      addBreadcrumb({
        level: sentrySeverityMap.get(log.level) || 'log',
        timestamp: log.time.getTime(),
        ...(message && { message }),
        ...(log.data && { data: log.data }),
      });
    }
    if (log.level >= Level.Error && log.err) {
      sentryCaptureLog(log, options);
    }
    return log;
  };
}

export function attachSentryListener(
  logger: Logger,
  options: SentryListenerOptions = {},
): Logger {
  const listener = createSentryListener(options);

  logger.on('log', (log) => {
    listener(log);
  });
  logger.on('flush', async () => {
    await flush(1000);
  });
  return logger;
}
