import { Level, type LogDescriptor } from '../logger.js';

export function gcpErrorProcessor(log: LogDescriptor): LogDescriptor {
  // dont augment anything less than an actual error
  if (log.level < Level.Error) {
    return log;
  }

  // not errorish
  if (!log.data || !('err' in log.data) || !log.data.err) {
    return log;
  }

  const { err, ...data } = log.data;
  const { stack, message, ...restErr } =
    err instanceof Error ? err : Object(err);

  return {
    ...log,
    data: {
      ...data,
      '@type':
        'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
      stack_trace: stack,
      message,
      ...restErr,
    },
  };
}
