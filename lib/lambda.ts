import type { AlsContext, Logger } from './types.js';

/** @deprecated */
type AnyFunction = (...args: any) => any;
/** @deprecated */
type Wrapped<T extends AnyFunction> = (next: T) => (fn: T) => ReturnType<T>;

/** @deprecated */
export function lambdaLoggerContextWrapper<T extends AnyFunction>(
  logger: Logger,
  id: AlsContext['id'],
  context?: AlsContext['context'],
): Wrapped<T> {
  return (fn) => {
    return logger.als.run({ id, ...(context && { context }) }, () => {
      return fn();
    });
  };
}

export function withLambdaLoggerContextWrapper<T>(
  logger: Logger,
  id: AlsContext['id'],
  fn: (...args: any) => Promise<T>,
  context?: AlsContext['context'],
): Promise<T> {
  return logger.als.run({ id, ...(context && { context }) }, () => {
    return fn();
  });
}
