import type { Context } from 'aws-lambda';
import type { Logger } from './types.js';

type LambdaContext = Partial<Context> & Required<Pick<Context, 'awsRequestId'>>;

export function withLambdaLoggerContextWrapper<T>(
  logger: Logger,
  context: LambdaContext,
  fn: (...args: any) => Promise<T>,
): Promise<T> {
  return logger.als.run(
    {
      id: context.awsRequestId,
      context: {
        // functionName: context.functionName,
        // ...(context.functionVersion !== '$LATEST' && {
        //   functionVersion: context.functionVersion,
        // }),
      },
    },
    () => {
      return fn();
    },
  );
}
