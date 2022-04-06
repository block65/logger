import { LogDescriptor, Level, Transformer, Decorator } from '../logger.js';
import { isEmptyObject, isPlainObject } from '../utils.js';
import { jsonTransformer } from './json.js';

export type GcpSeverities = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export const logLevelGcpSeverityMap = new Map<Level, GcpSeverities>([
  [Level.Trace, 'DEBUG'],
  [Level.Debug, 'DEBUG'],
  [Level.Info, 'INFO'],
  [Level.Warn, 'WARNING'],
  [Level.Error, 'ERROR'],
  [Level.Fatal, 'CRITICAL'],
]);

export const gcpDecorator: Decorator = (log: LogDescriptor): LogDescriptor => {
  if (log.level < Level.Warn) {
    return log;
  }

  const { err, ...restData } = log.data || {};

  if (!isPlainObject(err)) {
    return log;
  }

  const { stack, message, ...restErr } = err;

  return {
    ...log,
    data: {
      ...restData,
      '@type':
        'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
      stack_trace: stack,
      message,
      ...(!isEmptyObject(restErr) && {
        meta: restErr,
      }),
    },
  };
};

export const gcpTransformer: Transformer = (log: LogDescriptor): string => {
  return jsonTransformer(gcpDecorator(log));
};
