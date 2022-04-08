import { Logger, LogDescriptor } from '../logger.js';

export function asyncLocalStorageProcessor(
  this: Logger,
  log: LogDescriptor,
): LogDescriptor {
  const store = this.als.getStore();

  if (!store) {
    return log;
  }

  return {
    ...log,
    ...(store?.context && {
      ctx: {
        ...log.ctx,
        ...store?.context,
      },
    }),
  };
}
