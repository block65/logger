import { serializeError } from 'serialize-error';
import { Decorator } from '../logger.js';

export const errorDecorator: Decorator = (log) => {
  if (log.data && typeof log.data === 'object') {
    if (log.data instanceof Error) {
      return {
        ...log,
        data: serializeError(log.data),
      };
    }
    if ('err' in log.data && log.data.err instanceof Error) {
      return {
        ...log,
        data: {
          ...log.data,
          err: serializeError(log.data),
        },
      };
    }
  }

  return log;
};
