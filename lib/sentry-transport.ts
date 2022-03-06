import { captureException, Severity } from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import pino from 'pino';
import build from 'pino-abstract-transport';
import { LogDescriptor, LogLevelNumbers } from './types.js';

export interface SentryTransportOptions {
  dsn: string;
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
  minLogLevel?: pino.Level;
}

interface DirectSentryTransportOptions {
  dsn: string;
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>; // extra is deprecated
  minLogLevel?: pino.Level;
}

const sentrySeverityMap = new Map<LogLevelNumbers, Severity>([
  [LogLevelNumbers.Fatal, Severity.Fatal],
  [LogLevelNumbers.Error, Severity.Error],
  [LogLevelNumbers.Warn, Severity.Warning],
  [LogLevelNumbers.Info, Severity.Info],
  [LogLevelNumbers.Debug, Severity.Debug],
  [LogLevelNumbers.Trace, Severity.Debug],
]);

export function sentryCaptureLog(
  log: LogDescriptor,
  options: DirectSentryTransportOptions,
) {
  const context: Partial<ScopeContext> = {
    level: sentrySeverityMap.get(log.level) || Severity.Log,
    ...options.context,
  };

  // the err prop exists when something error-ish was detected in the log call
  if ('err' in log) {
    captureException(Object.assign(new Error(), log.err), context);
  } else {
    captureException(
      Object.assign(new Error(log.msg), {
        stack: log.stack,
      }),
      context,
    );
  }
}

export default function sentryTransport(options: DirectSentryTransportOptions) {
  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const log of source) {
        sentryCaptureLog(log, options);
        // setImmediate(() => sentryCaptureLog(log, options));
      }
    },
    {
      async close(err?: Error) {
        if (err) {
          console.warn(err);
        }
      },
    },
  );
}
