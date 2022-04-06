import { serializeError } from 'serialize-error';
import { Decorator } from '../logger.js';

export const errorDecorator: Decorator = (log) => {
  if (log.data && typeof log.data === 'object') {
    if (log.data instanceof Error) {
      return {
        ...log,
        msg: log.msg || log.data.message,
        data: {
          err: serializeError(log.data),
        },
      };
    }

    const { err, ...rest } = log.data;

    if (err instanceof Error) {
      return {
        ...log,
        msg: log.msg || err.message,
        data: {
          ...rest,
          err: serializeError(err),
        },
      };
    }
  }

  return log;
};
