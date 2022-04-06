import { captureException, Severity } from '@sentry/node';
import type { ScopeContext } from '@sentry/types';
import { Decorator, InternalLogRepresentation, Level } from '../logger2.js';
import { LevelWithSilent } from '../types.js';

export interface SentryTransportOptions {
  // extra is deprecated - see https://docs.sentry.io/platforms/javascript/enriching-events/context/#additional-data
  context?: Partial<Omit<ScopeContext, 'extra'>>;
  minLogLevel?: LevelWithSilent;
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
  log: InternalLogRepresentation,
  options: SentryTransportOptions,
) {
  const context: Partial<ScopeContext> = {
    level: sentrySeverityMap.get(log.level) || Severity.Log,
    ...options.context,
  };

  // the err prop exists when something error-ish was detected in the log call
  if (typeof log.data === 'object' && log.data && 'err' in log.data) {
    captureException(Object.assign(new Error(), log.data.err), context);
  } else {
    captureException(
      Object.assign(new Error(log.msg), {
        stack: log.data?.err?.stack,
      }),
      context,
    );
  }
}

export function sentryDecorator(options: SentryTransportOptions): Decorator {
  return function* (log: InternalLogRepresentation) {
    sentryCaptureLog(log, options);
    if (log) {
      yield log;
    }
    return log;
  };
}

export default sentryDecorator;
