import { createNamespace, Namespace } from 'cls-hooked';
import type { RequestHandler } from 'express';
import { sep } from 'path';
import pino from 'pino';
import PinoPretty from 'pino-pretty';
import { serializeError } from 'serialize-error';
import { Logger } from './types.js';

type Falsy = false | undefined | null;

type MixinFnWithData = (
  data: ReturnType<pino.MixinFn>,
) => ReturnType<pino.MixinFn>;

interface ClsContext {
  _contextId: string;
  _context?: Record<string, unknown>;
}

type NamespaceContext = {
  id?: unknown;
  _ns_name?: unknown;
} & Partial<ClsContext>;

type ComputePlatform = 'gcp-cloudrun' | 'aws-lambda' | 'aws';

export interface CreateLoggerOptions
  extends Omit<pino.LoggerOptions, 'mixin' | 'prettyPrint' | 'prettifier'> {
  pretty?: boolean;
  traceCaller?: boolean;
  platform?: ComputePlatform;
  mixins?: (MixinFnWithData | pino.MixinFn | Falsy)[];
  transports?: pino.TransportMultiOptions;
}

const defaultLoggerOptions: pino.LoggerOptions = {
  level: 'info',
  serializers: {
    err: serializeError,
  },
};

const gcpLevelToSeverity: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

function isPlainObject<T extends Record<string, unknown>>(
  value: unknown | T,
): value is T {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.getPrototypeOf({});
}

function gcpLogs(details: object): object {
  if (isPlainObject(details)) {
    if ('stack' in details) {
      const { stack, ...rest } = details;
      if (stack) {
        return {
          stack_trace: stack,
          ...rest,
        };
      }
    }

    if (
      ('err' in details && isPlainObject(details.err)) ||
      details.err instanceof Error
    ) {
      const { err, ...rest } = details;
      const { stack, ...restErr } = err;
      if (stack) {
        return {
          stack_trace: stack,
          ...rest,
          ...restErr,
        };
      }
    }
  }
  return details;
}

function stringifyUndefined(details: unknown | object): object {
  if (isPlainObject(details)) {
    return Object.fromEntries(
      Object.entries(details).map(([k, v]) => {
        if (typeof v === 'undefined') {
          return [k, '_(undefined)'];
        }
        return [k, stringifyUndefined(v)];
      }),
    );
  }
  return Object(details);
}

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

function getPlatformLoggerOptions(
  platform = detectPlatform(),
): pino.LoggerOptions {
  switch (platform) {
    // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
    case 'gcp-cloudrun':
      return {
        // pid is always 1 on Cloud Run, and instance id/resource is part of the
        // log sent to GCP logging, so hostname is not required
        base: undefined,

        level: 'info',
        messageKey: 'message',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(levelLabel, levelNumber) {
            return {
              severity: gcpLevelToSeverity[levelLabel],
              ...(levelNumber >= 50 && {
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
          log: (details) => gcpLogs(stringifyUndefined(details)),
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

let counter = 0;

function callerMixin(): { caller?: string } {
  const stackParts = new Error().stack?.split('\n') || [];

  const nonModuleFramesIndex = stackParts
    .map(
      (s) =>
        s.includes(`node_modules${sep}pino`) ||
        s.includes(`block65${sep}logger`),
    )
    .lastIndexOf(true);

  if (nonModuleFramesIndex === -1) {
    return {};
  }

  const frameCandidate: string | undefined =
    stackParts[nonModuleFramesIndex + 1];

  const caller = frameCandidate
    ? frameCandidate.substr(7).replace(`${process.cwd()}/`, '')
    : frameCandidate;

  return {
    caller,
  };
}

function composeMixins(
  mixins: (MixinFnWithData | pino.MixinFn | Falsy)[],
): pino.MixinFn {
  return () =>
    mixins.reduce((accum, mixin) => {
      if (!mixin) {
        return accum;
      }
      return {
        ...accum,
        ...mixin(accum),
      };
    }, {});
}

function createContextMixin(cls: Namespace): pino.MixinFn {
  return (): Partial<ClsContext> => {
    const { active }: { active: NamespaceContext | null } = cls || {};

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { id, _ns_name, ...clsContext } = active || {};
    return clsContext;
  };
}

export type CreateLoggerOptionsWithoutTransports = Omit<
  CreateLoggerOptions,
  'pretty' | 'transports'
>;

export function createLogger(
  opts: CreateLoggerOptionsWithoutTransports,
  destination: pino.DestinationStream,
): Logger;
export function createLogger(opts?: CreateLoggerOptions): Logger;
export function createLogger(
  opts: CreateLoggerOptions = {},
  destination?: pino.DestinationStream,
): Logger {
  if (destination && opts.transports) {
    throw new Error('Please provide only one of `destination` or `transports`');
  }

  if (destination && opts.pretty) {
    throw new Error('Please provide only one of `destination` or `pretty`');
  }

  const cls = createNamespace(`logger/${counter}`);
  counter += 1;

  const isDevelopment = process.env.NODE_ENV === 'development';

  const {
    platform,
    traceCaller = isDevelopment,
    mixins = [],
    ...userPinoOpts
  } = opts;

  const platformLoggerOptions = getPlatformLoggerOptions(platform);

  const mixin = composeMixins([
    ...mixins,
    createContextMixin(cls),
    traceCaller && callerMixin,
  ]);

  const transport =
    destination ||
    pino.transport({
      ...opts.transports,
      targets: [
        ...(opts.transports?.targets || []),
        ...(opts.pretty
          ? [
              {
                target: 'pino-pretty',
                level: 'info',
                options: {
                  ignore: 'pid,hostname',
                  translateTime: true,
                  singleLine: true,
                } as PinoPretty.PrettyOptions,
              },
            ]
          : ([] as any[])),
      ],
    });

  const pinoInstance = pino(
    {
      ...defaultLoggerOptions,
      ...platformLoggerOptions,
      ...userPinoOpts,
      // ...transportOptions,
      mixin,
    },
    transport,
  );

  return Object.create(pinoInstance, {
    cls: {
      value: cls,
      configurable: false,
    },
  });
}

export function expressLogger(
  namespace: Namespace,
  contextId: ClsContext['_contextId'],
  context?: ClsContext['_context'],
): RequestHandler {
  return (req, res, next): void => {
    res.set('x-context-id', contextId);

    namespace.run(() => {
      namespace.set('_contextId', contextId);
      if (context) {
        namespace.set('_context', context);
      }
      next();
    });
  };
}

export function lambdaLogger<T extends (...args: any[]) => any>(
  namespace: Namespace,
  contextId: ClsContext['_contextId'],
  context?: ClsContext['_context'],
): (next: T) => (fn: T) => ReturnType<T> {
  return (fn) => {
    return namespace.runAndReturn(() => {
      namespace.set('_contextId', contextId);
      if (context) {
        namespace.set('_context', context);
      }
      return fn();
    });
  };
}
