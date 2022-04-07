import { hostname } from 'node:os';
import { CreateLoggerOptions, Logger } from './logger.js';
import { lambdaProcessor } from './processors/lambda.js';
import { createCloudwatchTransformer } from './transformers/cloudwatch.js';
import { gcpProcessor, gcpTransformer } from './transformers/gcp.js';

export { expressLoggerContextMiddleware } from './express.js';
export { withLambdaLoggerContextWrapper } from './lambda.js';
export { createLogger } from './logger.js';
export type {
  CreateLoggerOptions,
  Level,
  LogDescriptor,
  Logger,
} from './logger.js';

export function createAutoConfiguredLogger(
  options: CreateLoggerOptions = {},
): Logger {
  // Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return new Logger({
      destination: process.stdout,
      processors: [lambdaProcessor],
      transformer: createCloudwatchTransformer(),
      context: {
        ...options.context,
      },
      ...options,
    });
  }

  // ECS
  if (process.env.ECS_AVAILABLE_LOGGING_DRIVERS?.includes('aws-logs')) {
    return new Logger({
      destination: process.stdout,
      transformer: createCloudwatchTransformer(),
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
      destination: process.stdout,
      processors: [gcpProcessor],
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
    destination: process.stdout,
    context: {
      ...options.context,
      pid: process.pid,
      hostname: hostname(),
    },
    ...options,
  });
}
