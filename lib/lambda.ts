import type { Namespace } from 'cls-hooked';
import type { ClsContext } from './types.js';

export function lambdaLoggerContextWrapper<T extends (...args: any[]) => any>(
  namespace: Namespace,
  contextId: ClsContext['_contextId'],
  context?: ClsContext['_context'],
): (next: T) => (fn: T) => ReturnType<T> {
  return (fn) => {
    return namespace.runAndReturn(() => {
      namespace.set('_contextId', contextId);
      if (context) {
        namespace.set('_context', context);
      }
      return fn();
    });
  };
}

/**
 * @deprecated
 * @use {lambdaLoggerContextWrapper}
 * @see {lambdaLoggerContextWrapper}
 */
export const lambdaLogger = lambdaLoggerContextWrapper;
