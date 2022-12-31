import type { RequestHandler } from 'express';
import type { AlsContext } from './logger.js';
import type { Logger } from './index.js';

export function expressLoggerContextMiddleware(
  logger: Logger,
  id: AlsContext['id'],
  context?: AlsContext['context'],
): RequestHandler {
  return (_, res, next) => {
    res.set('x-context-id', id);

    logger.als.run({ id, ...(context && { context }) }, () => {
      next();
    });
  };
}
