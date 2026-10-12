import { hostname } from 'node:os';
import { Writable } from 'node:stream';
import {
  Level,
  Logger,
  parseLevel,
  type CreateLoggerOptions,
} from './logger.js';
import { callerProcessor } from './processors/caller.js';
import { createCliTransformer } from './transformers/cli.js';
import { createCloudwatchTransformer } from './transformers/cloudwatch.js';
import { gcpTransformer } from './transformers/gcp.js';
import { jsonTransformer } from './transformers/json.js';

export { Level, Logger, parseLevel } from './logger.js';
export type {
  CreateLoggerOptions,
  LogDescriptor,
  LevelAsString,
} from './logger.js';
export { createRedactProcessor } from './processors/redact.js';
export { createCliTransformer } from './transformers/cli.js';
export { jsonTransformer, type JsonLogFormat } from './transformers/json.js';

export function createLogger(
  options: Omit<CreateLoggerOptions, 'transformer'> = {},
): Logger {
  const recommendedProcessors =
    process.env.NODE_ENV === 'development' ? [callerProcessor] : [];

  const level =
    options.level ??
    parseLevel(process.env.LOG_LEVEL) ??
    (process.env.NODE_ENV === 'development' ? Level.Trace : undefined);

  const destination =
    options.destination ?? Writable.toWeb(process.stdout);

  // Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return new Logger({
      level,
      destination,
      processors: [...recommendedProcessors, ...(options.processors ?? [])],
      ...options,
      transformer: createCloudwatchTransformer(),
    });
  }

  // ECS
  if (process.env.ECS_AVAILABLE_LOGGING_DRIVERS?.includes('awslogs')) {
    return new Logger({
      level,
      destination,
      transformer: createCloudwatchTransformer(),
      processors: [...recommendedProcessors, ...(options.processors ?? [])],
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
      destination,
      processors: [...recommendedProcessors, ...(options.processors ?? [])],
      transformer: gcpTransformer,
      context: {
        ...options.context,
        pid: process.pid,
        hostname: hostname(),
      },
      ...options,
    });
  }

  // TTY or CI
  if (process.env.CI || ('isTTY' in destination && destination.isTTY)) {
    return new Logger({
      level,
      destination,
      transformer: createCliTransformer(),
      ...options,
    });
  }

  return new Logger({
    level,
    destination,
    transformer: jsonTransformer,
    ...options,
  });
}