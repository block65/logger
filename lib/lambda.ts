import type { AsyncLocalStorage } from 'node:async_hooks';
import type { AlsContext } from './types.js';

/** @deprecated */
type AnyFunction = (...args: any) => any;
/** @deprecated */
type Wrapped<T extends AnyFunction> = (next: T) => (fn: T) => ReturnType<T>;

/** @deprecated */
export function lambdaLoggerContextWrapper<T extends AnyFunction>(
  asyncLocalStorage: AsyncLocalStorage<AlsContext>,
  id: AlsContext['id'],
  context?: AlsContext['context'],
): Wrapped<T> {
  return (fn) => {
    return asyncLocalStorage.run({ id, ...(context && { context }) }, () => {
      return fn();
    });
  };
}

export function withLambdaLoggerContextWrapper<T>(
  asyncLocalStorage: AsyncLocalStorage<AlsContext>,
  id: AlsContext['id'],
  fn: (...args: any) => Promise<T>,
  context?: AlsContext['context'],
): Promise<T> {
  return asyncLocalStorage.run({ id, ...(context && { context }) }, () => {
    return fn();
  });
}
