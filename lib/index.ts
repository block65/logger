import { hostname } from 'node:os';
import { CreateLoggerOptions, Level, Logger } from './logger.js';
import { callerProcessor } from './processors/caller.js';
import { lambdaProcessor } from './processors/lambda.js';
import { attachSentryProcessor } from './processors/sentry.js';
import { createCloudwatchTransformer } from './transformers/cloudwatch.js';
import { gcpTransformer } from './transformers/gcp.js';

export { expressLoggerContextMiddleware } from './express.js';
export { withLambdaLoggerContextWrapper } from './lambda.js';
export { Level } from './logger.js';
export type { CreateLoggerOptions, LogDescriptor, Logger } from './logger.js';
export { createRedactProcessor } from './processors/redact.js';

function internalCreateLogger(
  options: Omit<CreateLoggerOptions, 'transformer'> = {},
): Logger {
  const recommendedProcessors =
    process.env.NODE_ENV === 'development' ? [callerProcessor] : [];

  const level = options.level || (process.env.LOG_LEVEL as Level | undefined);


  // Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return new Logger({
      level,
      destination: process.stdout,
      processors: [
        ...recommendedProcessors,
        ...(options.processors || []),
        lambdaProcessor,
      ],
      ...options,
      transformer: createCloudwatchTransformer(),
    });
  }

  // ECS
  if (process.env.ECS_AVAILABLE_LOGGING_DRIVERS?.includes('aws-logs')) {
    return new Logger({
      level,
      destination: process.stdout,
      transformer: createCloudwatchTransformer(),
      processors: [...recommendedProcessors],
      context: {
        ...options.context,
        pid: process.pid,
        hostname: hostname(),
      },
      ...options,
    });
  }

  // GCP (Knative)
  if (
    'K_CONFIGURATION' in process.env &&
    'K_SERVICE' in process.env &&
    'K_REVISION' in process.env
  ) {
    return new Logger({
      level,
      destination: process.stdout,
      processors: [...recommendedProcessors],
      transformer: gcpTransformer,
      context: {
        ...options.context,
        pid: process.pid,
        hostname: hostname(),
      },
      ...options,
    });
  }

  return new Logger({
    level,
    destination: process.stdout,
    ...options,
    context: {
      ...options.context,
      pid: process.pid,
      hostname: hostname(),
    },
  });
}

function trySentry(logger: Logger) {
  import('@sentry/node')
    .then((Sentry) => {
      const sentryOptions = Sentry.getCurrentHub().getClient()?.getOptions();
      if (sentryOptions?.dsn) {
        attachSentryProcessor(logger);
      }
    })
    .catch(() => {
      // no sentry module
    });
}

export function createLogger(
  options: Omit<CreateLoggerOptions, 'transformer'> = {},
): Logger {
  const logger = internalCreateLogger(options);
  trySentry(logger);
  return logger;
}
