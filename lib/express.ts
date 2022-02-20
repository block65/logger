import { AsyncLocalStorage } from 'async_hooks';
import type { RequestHandler } from 'express';
import type { AlsContext } from './types.js';

export function expressLoggerContextMiddleware(
  als: AsyncLocalStorage<AlsContext>,
  id: AlsContext['id'],
  context?: AlsContext['context'],
): RequestHandler {
  return (req, res, next) => {
    res.set('x-context-id', id);

    als.run({ id, ...(context && { context }) }, () => {
      next();
    });
  };
}
