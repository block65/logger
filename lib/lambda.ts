import type { Context } from 'aws-lambda';
import type { ConditionalPick, Primitive } from 'type-fest';
import type { AlsContext, Logger } from './types.js';

type LambdaContext = AlsContext['context'] &
  ConditionalPick<Context, Primitive>;

export function withLambdaLoggerContextWrapper<T>(
  logger: Logger,
  context: LambdaContext,
  fn: (...args: any) => Promise<T>,
): Promise<T> {
  return logger.als.run(
    {
      id: context.awsRequestId,
      context: { awsRequestId: context.awsRequestId },
    },
    () => {
      return fn();
    },
  );
}
