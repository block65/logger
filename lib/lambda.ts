import type { Context } from 'aws-lambda';
import type { JsonifiableObject } from 'type-fest/source/jsonifiable.js';
import type { Logger } from './logger.js';
import { isEmptyObject } from './utils.js';

type LambdaContext = Partial<Context> & Required<Pick<Context, 'awsRequestId'>>;

export function withLambdaLoggerContextWrapper<T>(
  logger: Logger,
  lambdaContext: LambdaContext,
  fn: (...args: any) => Promise<T>,
): Promise<T> {
  const context = {
    // functionName: context.functionName,
    ...(lambdaContext.functionVersion !== '$LATEST' && {
      functionVersion: lambdaContext.functionVersion,
    }),
  } satisfies JsonifiableObject;

  return logger.als.run(
    {
      id: lambdaContext.awsRequestId,
      ...(!isEmptyObject(context) && { context }),
    },
    () => fn().finally(() => logger.flush()),
  );
}
