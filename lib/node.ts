import { createNamespace, Namespace } from 'cls-hooked';
import { randomBytes } from 'crypto';
import type { RequestHandler } from 'express';
import { hostname } from 'os';
import { sep } from 'path';
import pino from 'pino';
import { serializeError } from 'serialize-error';

type Falsy = false | undefined | null;

type MixinFnWithData = (
  data: ReturnType<pino.MixinFn>,
) => ReturnType<pino.MixinFn>;

export type BaseLogger = pino.Logger;

export type Logger = {
  cls: Namespace;
} & BaseLogger;

interface ClsContext {
  _contextId: string;
  _context?: Record<string, unknown>;
}

type NamespaceContext = {
  id?: unknown;
  _ns_name?: unknown;
} & Partial<ClsContext>;

type ComputePlatform = 'gcp-cloudrun' | 'aws-lambda' | 'aws';

export interface CreateLoggerOptions extends Omit<pino.LoggerOptions, 'mixin'> {
  traceCaller?: boolean;
  platform?: ComputePlatform;
  mixins?: (MixinFnWithData | pino.MixinFn | Falsy)[];
}

const suggestedHostname = hostname();

const defaultLoggerOptions: pino.LoggerOptions = {
  level: 'info',
  serializers: {
    err: serializeError,
  },
  base: {
    pid: process.pid,
    // in the case we get localhost (gcp cloud run), use random bytes instead
    // this helps us debug if we need to isolate calls running in a specific
    // container or instance (one which stays alive between invocations)
    hostname:
      suggestedHostname !== 'localhost'
        ? suggestedHostname
        : `zz${randomBytes(5).toString('hex')}`, // zz indicates synthetic hostname
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

function getPlatformLoggerOptions(
  platform?: ComputePlatform,
): pino.LoggerOptions {
  switch (platform) {
    // See https://cloud.google.com/error-reporting/docs/formatting-error-messages
    case 'gcp-cloudrun':
      return {
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

    case 'aws':
    case 'aws-lambda':
    default:
      return {
        formatters: {
          log: (details) => stringifyUndefined(details),
        },
      };
  }
}

let counter = 0;

function callerMixin(): { caller: string | undefined } {
  const stackParts = Error().stack?.split('\n') || [];

  const nonModuleFramesIndex = stackParts
    .map(
      (s) =>
        s.includes(`node_modules${sep}pino`) ||
        s.includes(`block65${sep}logger`),
    )
    .lastIndexOf(true);

  const frameCandidate: string | undefined =
    stackParts[nonModuleFramesIndex + 1];

  return {
    caller: frameCandidate
      ? frameCandidate.substr(7).replace(`${process.cwd()}/`, '')
      : frameCandidate,
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

export function createLogger(
  opts: CreateLoggerOptions = {},
  stream?: pino.DestinationStream,
  // destination?: pino.DestinationStream,
): Logger {
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

  const pinoInstance = stream
    ? pino(
        {
          ...defaultLoggerOptions,
          ...platformLoggerOptions,
          ...userPinoOpts,
          mixin,
        },
        stream,
      )
    : pino({
        ...defaultLoggerOptions,
        ...platformLoggerOptions,
        ...userPinoOpts,
        mixin,
      });

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
