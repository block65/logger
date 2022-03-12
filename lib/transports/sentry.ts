import { captureException, Severity } from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import build from 'pino-abstract-transport';
import { LevelWithSilent, LogDescriptor, LogLevelNumbers } from '../types.js';

export interface SentryTransportOptions {
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
  minLogLevel?: LevelWithSilent;
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
  options: SentryTransportOptions,
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

export function sentryTransport(options: SentryTransportOptions) {
  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const log of source) {
        sentryCaptureLog(log, options);
        // setImmediate(() => sentryCaptureLog(log, options));
      }

      // await flush(1000).catch(console.warn);
    },
    {
      async close(err?: Error) {
        if (err) {
          console.warn(err);
        }
        // destination.end();
        // await once(destination, 'close');
        // await flush(1000).catch(console.warn);
      },
    },
  );
}

export default sentryTransport;
