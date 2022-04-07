import {
  Level,
  LogData,
  LogDescriptor,
  Processor,
  Transformer,
} from '../logger.js';
import { isEmptyObject, withNullProto } from '../utils.js';

type GcpSeverities = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

type GcpJsonLogFormat = {
  severity: GcpSeverities;
  time: string;
  message?: string;
  ctx?: LogData;
} & LogData;

const logLevelGcpSeverityMap = new Map<Level, GcpSeverities>([
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

  if (!log.err) {
    return log;
  }

  const { stack, message, ...restErr } = log.err;

  return {
    ...log,
    data: {
      ...log.data,
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
  const { level, time, ctx, data, msg } = log;

  // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
  const jsonLog: GcpJsonLogFormat = withNullProto({
    severity: logLevelGcpSeverityMap.get(level) || 'INFO',
    time: time.toISOString(),
    message: msg,
    ...data,
    ctx,
  });

  return JSON.stringify(jsonLog);
};
