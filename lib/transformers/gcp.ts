import { LogDescriptor, Level, Transformer } from '../logger.js';
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

export const gcpTransformer: Transformer = (log: LogDescriptor): string => {
  if (log.level < Level.Error) {
    return jsonTransformer(log);
  }

  const err = log.data?.err;

  if (!isPlainObject(err)) {
    return jsonTransformer(log);
  }

  const { stack, message, ...restErr } = err;

  return jsonTransformer({
    ...log,
    data: {
      '@type':
        'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
      stack_trace: stack,
      message,

      ...(!isEmptyObject(restErr) && {
        meta: restErr,
        data: log.data,
      }),
    },
  });
};
