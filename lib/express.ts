import type { RequestHandler } from 'express';
import type { AlsContext, Logger } from './types.js';

export function expressLoggerContextMiddleware(
  logger: Logger,
  id: AlsContext['id'],
  context?: AlsContext['context'],
): RequestHandler {
  return (req, res, next) => {
    res.set('x-context-id', id);

    logger.als.run({ id, ...(context && { context }) }, () => {
      next();
    });
  };
}
