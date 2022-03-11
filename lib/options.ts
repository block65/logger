import { isatty } from 'node:tty';
import pino from 'pino';
import { serializeError } from 'serialize-error';
import { formatGcpLogObject, logLevelGcpSeverityMap } from './gcp.js';
import {
  LogFormat,
  LogLevelNumbers,
  PinoLoggerOptions,
  PinoLoggerOptionsWithLevel,
  Platform,
} from './types.js';
import { stringifyUndefined } from './utils.js';

export const defaultLoggerOptions: PinoLoggerOptionsWithLevel = {
  level: 'info' as const,
  serializers: {
    err: serializeError,
  },
};

function detectPlatform(): Platform {
  // Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    return 'aws-lambda';
  }

  // ECS
  if (process.env.ECS_AVAILABLE_LOGGING_DRIVERS?.includes('aws-logs')) {
    return 'aws-ecs';
  }

  if (
    'K_CONFIGURATION' in process.env &&
    'K_SERVICE' in process.env &&
    'K_REVISION' in process.env
  ) {
    return 'gcp-cloudrun';
  }

  return 'unknown';
}

function detectLogFormat(
  destination: string | number | pino.DestinationStream,
  platform: Platform,
): LogFormat {
  switch (platform) {
    case 'aws-ecs':
    case 'aws-lambda':
      return 'aws-cloudwatch';
    case 'gcp-cloudrun':
      return 'gcp';
    case 'unknown':
    default:
      if (typeof destination === 'number' && isatty(destination)) {
        return 'cli';
      }

      return 'json';
  }
}

function internalGetLogFormatOptions(
  destination: string | number | pino.DestinationStream,
  platform: Platform,
  logFormat: LogFormat,
): Omit<PinoLoggerOptions, 'transport'> {
  switch (logFormat) {
    // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
    case 'gcp':
      return {
        // pid is always 1 on Cloud Run, and instance id/resource is part of the
        // log sent to GCP logging, so hostname is not required
        base: undefined,

        messageKey: 'message',
        timestamp: pino.stdTimeFunctions.isoTime,

        formatters: {
          level(levelLabel, levelNumber) {
            // @see https://cloud.google.com/error-reporting/docs/formatting-error-messages
            return {
              severity: logLevelGcpSeverityMap.get(levelLabel),
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

    case 'aws-cloudwatch':
      return {
        // no hostname or pid logging on lambda (no point)
        ...(platform === 'aws-lambda' && { base: undefined }),

        // formatters: {
        //   log: (details) => stringifyUndefined(details),
        // },
      };

    case 'cli':
      return {};

    default:
      return {
        formatters: {
          log: (details) => stringifyUndefined(details),
        },
      };
  }
}

export function getLogFormatOptions(
  destination: string | number | pino.DestinationStream,
  platform: Platform = detectPlatform(),
  logFormat: LogFormat = detectLogFormat(destination, platform),
): [
  platform: Platform,
  logFormat: LogFormat,
  options: Omit<PinoLoggerOptions, 'transport'>,
] {
  return [
    platform,
    logFormat,
    internalGetLogFormatOptions(destination, platform, logFormat),
  ];
}
