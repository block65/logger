import { hostname } from 'node:os';
import { CreateLoggerOptions, Level, LevelAsString, Logger } from './logger.js';
import { callerProcessor } from './processors/caller.js';
import { createCliTransformer } from './transformers/cli.js';
import { createCloudwatchTransformer } from './transformers/cloudwatch.js';
import { gcpTransformer } from './transformers/gcp.js';
import { jsonTransformer } from './transformers/json.js';

export { Level, Logger } from './logger.js';
export type { CreateLoggerOptions, LogDescriptor } from './logger.js';
export { createRedactProcessor } from './processors/redact.js';
export { createCliTransformer } from './transformers/cli.js';
export { jsonTransformer, type JsonLogFormat } from './transformers/json.js';

const stringLogLevelMap = new Map<LevelAsString | string | undefined, Level>([
  ['silent', Level.Silent],
  ['trace', Level.Trace],
  ['debug', Level.Debug],
  ['info', Level.Info],
  ['warn', Level.Warn],
  ['error', Level.Error],
  ['fatal', Level.Fatal],
]);

function internalCreateLogger(
  options: Omit<CreateLoggerOptions, 'transformer'> = {},
): Logger {
  const recommendedProcessors =
    process.env.NODE_ENV === 'development' ? [callerProcessor] : [];

  const level =
    options.level ||
    stringLogLevelMap.get(process.env.LOG_LEVEL?.toLocaleLowerCase()) ||
    (process.env.NODE_ENV === 'development' ? Level.Trace : undefined);

  const destination = options.destination || process.stdout;

  // Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return new Logger({
      level,
      destination,
      processors: [...recommendedProcessors, ...(options.processors || [])],
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
      processors: [...recommendedProcessors, ...(options.processors || [])],
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
      processors: [...recommendedProcessors, ...(options.processors || [])],
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

function trySentry(logger: Logger) {
  import('@sentry/node')
    .then(async (Sentry) => {
      const sentryOptions = Sentry.getCurrentHub().getClient()?.getOptions();
      // if sentry is configured with a DSN, attach a sentry processor
      if (sentryOptions?.dsn) {
        const { attachSentryListener } = await import('./listener/sentry.js');
        attachSentryListener(logger);
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
