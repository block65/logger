import pino from 'pino';
import { serializeError } from 'serialize-error';
import { formatGcpLogObject, gcpLevelToSeverity } from './gcp.js';
import { ComputePlatform, LogLevelNumbers } from './types.js';
import { stringifyUndefined } from './utils.js';

export const defaultLoggerOptions: Omit<pino.LoggerOptions, 'level'> & {
  level: pino.LevelWithSilent;
} = {
  level: 'info' as const,
  serializers: {
    err: serializeError,
  },
};

function detectPlatform(): ComputePlatform | undefined {
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return 'aws-lambda';
  }

  if (
    'K_CONFIGURATION' in process.env &&
    'K_SERVICE' in process.env &&
    'K_REVISION' in process.env
  ) {
    return 'gcp-cloudrun';
  }
}

export function getPlatformLoggerOptions(
  platform = detectPlatform(),
): Omit<pino.LoggerOptions, 'level'> & { level?: pino.LevelWithSilent } {
  switch (platform) {
    // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
    case 'gcp-cloudrun':
      return {
        // pid is always 1 on Cloud Run, and instance id/resource is part of the
        // log sent to GCP logging, so hostname is not required
        base: undefined,

        messageKey: 'message',
        timestamp: pino.stdTimeFunctions.isoTime,

        formatters: {
          level(levelLabel, levelNumber) {
            return {
              severity: gcpLevelToSeverity[levelLabel],
              ...(levelNumber >= LogLevelNumbers.Error && {
                '@type':
                  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
              }),
              // serviceContext: process.env.SERVICE_IDENTIFIER,
              // appContext: {
              //   env: process.env.NODE_ENV,
              //   stage: process.env.PRODUCT_STAGE,
              // },
            };
          },
          log: (details) => formatGcpLogObject(stringifyUndefined(details)),
        },
      };
    case 'aws-lambda':
      return {
        base: undefined, // no hostname or pid logging on lambda (no point)
        formatters: {
          log: (details) => stringifyUndefined(details),
        },
      };
    case 'aws':
    default:
      return {
        formatters: {
          log: (details) => stringifyUndefined(details),
        },
      };
  }
}
