import type { Namespace } from 'cls-hooked';
import type { RequestHandler } from 'express';
import type { ClsContext } from './types.js';

export function expressLoggerContextMiddleware(
  namespace: Namespace,
  contextId: ClsContext['_contextId'],
  context?: ClsContext['_context'],
): RequestHandler {
  return (req, res, next): void => {
    res.set('x-context-id', contextId);

    namespace.run(() => {
      namespace.set('_contextId', contextId);
      if (context) {
        namespace.set('_context', context);
      }
      next();
    });
  };
}

/**
 * @deprecated
 * @see {expressLoggerContextMiddleware}
 * @use {expressLoggerContextMiddleware}
 */
export const expressLogger = expressLoggerContextMiddleware;
