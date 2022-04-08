import type { Context } from 'aws-lambda';
import type { JsonObject } from 'type-fest';
import type { Logger } from './logger.js';
import { isEmptyObject } from './utils.js';

type LambdaContext = Partial<Context> & Required<Pick<Context, 'awsRequestId'>>;

export function withLambdaLoggerContextWrapper<T>(
  logger: Logger,
  lambdaContext: LambdaContext,
  fn: (...args: any) => Promise<T>,
): Promise<T> {
  const context: JsonObject = {
    // functionName: context.functionName,
    ...(lambdaContext.functionVersion !== '$LATEST' && {
      functionVersion: lambdaContext.functionVersion,
    }),
  };

  return logger.als.run(
    {
      id: lambdaContext.awsRequestId,
      ...(!isEmptyObject(context) && { context }),
    },
    () => {
      return fn();
    },
  );
}
