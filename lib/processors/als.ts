import { Logger, LogDescriptor } from '../logger.js';

export function asyncLocalStorageProcessor(
  this: Logger,
  log: LogDescriptor,
): LogDescriptor {
  const context = this.als.getStore();

  if (!context) {
    return log;
  }

  return {
    ...log,
    ...(context && {
      ctx: {
        ...log.ctx,
        ...context,
      },
    }),
  };
}
