import type { RequestHandler } from 'express';
import type { Logger } from './index.js';
import type { AlsContext } from './logger.js';

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
