import { Level, LogDescriptor, Processor, Transformer } from '../logger.js';
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

export const gcpProcessor: Processor = (log: LogDescriptor): LogDescriptor => {
  if (log.level < Level.Warn) {
    return log;
  }

  const { err, ...restData } =
    log.data instanceof Error ? { err: log.data } : log.data || {};

  if (!err || typeof err !== 'object' || Array.isArray(err)) {
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
      // ...(!isEmptyObject(restErr) && {
      //   meta: restErr,
      // }),
    },
  };
};

export const gcpTransformer: Transformer = (log: LogDescriptor): string => {
  return jsonTransformer(gcpProcessor(log));
};
