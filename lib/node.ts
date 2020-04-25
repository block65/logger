import { serializeError } from 'serialize-error';
import * as pino from 'pino';
import * as pinoHttp from 'pino-http';
import { createNamespace, Namespace } from 'cls-hooked';
import * as core from 'express-serve-static-core';
import { hostname } from 'os';
import { randomBytes } from 'crypto';

type LoggerWithNamespace = {
  cls: Namespace;
} & pino.Logger;

// nicer name for external usage
export type Logger = LoggerWithNamespace;

interface ClsContext {
  _contextId: string;
  _context?: Record<string, any>;
}

type NamespaceContext = {
  id?: unknown;
  // eslint-disable-next-line camelcase
  _ns_name?: unknown;
} & Partial<ClsContext>;

const suggestedHostname = hostname();

type ComputePlatform = 'gcp-cloudrun' | 'aws-lambda' | 'aws';

export interface CreateLoggerOptions extends pino.LoggerOptions {
  platform?: ComputePlatform;
}

const defaultLoggerOptions: pino.LoggerOptions = {
  level: 'info',
  serializers: {
    err: serializeError,
  },
  base: {
    pid: process.pid,
    // in the case we get localhost (gcp cloud run), use random bytes instead
    // this helps us debug if we need to isolate calls running in a specific
    // container or instance
    hostname:
      suggestedHostname !== 'localhost'
        ? suggestedHostname
        : `zz${randomBytes(5).toString('hex')}`, // zz indicates synthetic hostname
  },
};

let counter = 0;

function getPlatformOverrideMethods(
  pinoInstance: pino.Logger,
  platform?: ComputePlatform,
): { [k in pino.Level]: PropertyDescriptor } | null {
  switch (platform) {
    case 'gcp-cloudrun':
      return {
        fatal: { value: pinoInstance.FATAL },
        error: { value: pinoInstance.ERROR },
        warn: { value: pinoInstance.WARNING },
        info: { value: pinoInstance.INFO },
        debug: { value: pinoInstance.DEBUG },
        trace: { value: pinoInstance.DEBUG },
      };
    // NOTE: AWS NOT YET IMPLEMENTED - MAY NOT EVEN BE NEEDED
    case 'aws':
    case 'aws-lambda':
    default:
      return null;
  }
}

function getPlatformLoggerOptions(
  platform?: ComputePlatform,
): pino.LoggerOptions {
  switch (platform) {
    case 'gcp-cloudrun':
      return {
        level: 'INFO',
        customLevels: {
          DEBUG: 100,
          INFO: 200,
          NOTICE: 300,
          WARNING: 400,
          ERROR: 500,
          CRITICAL: 600,
          ALERT: 700,
          EMERGENCY: 800,
        },
        useOnlyCustomLevels: true,
        messageKey: 'message',
        changeLevelName: 'severity',
        useLevelLabels: true,
        timestamp: pino.stdTimeFunctions.isoTime,
        // mixin: () => {
        //   return {
        //     timestamp: new Date().toJSON()
        //   }
        // }};
      };
    case 'aws':
    case 'aws-lambda':
    default:
      return {};
  }
}

export function createLogger(
  opts: CreateLoggerOptions = {},
  stream?: pino.DestinationStream,
  // destination?: pino.DestinationStream,
): LoggerWithNamespace {
  const cls = createNamespace(`logger/${counter}`);
  counter += 1;

  const { platform, ...userPinoOpts } = opts;

  function mixin(): Partial<ClsContext> {
    const { active }: { active: NamespaceContext | null } = cls || {};
    // eslint-disable-next-line camelcase, @typescript-eslint/camelcase,@typescript-eslint/no-unused-vars
    const { id, _ns_name, ...clsContext } = active || {};
    return userPinoOpts.mixin
      ? { ...clsContext, ...userPinoOpts.mixin() }
      : clsContext;
  }

  const platformLoggerOptions = getPlatformLoggerOptions(platform);

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

  const overrideMethods =
    getPlatformOverrideMethods(pinoInstance, platform) || {};

  return Object.create(pinoInstance, {
    ...overrideMethods,
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
): core.RequestHandler {
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

export function lambdaLogger(
  namespace: Namespace,
  contextId: ClsContext['_contextId'],
  context?: ClsContext['_context'],
): Function {
  return (next: Function): void => {
    return namespace.runAndReturn(() => {
      namespace.set('_contextId', contextId);
      if (context) {
        namespace.set('_context', context);
      }
      return next();
    });
  };
}

export function createHttpLogger(logger: pino.Logger): pinoHttp.HttpLogger {
  return pinoHttp({
    logger,
    customLogLevel(res, err) {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      }
      if (res.statusCode >= 500 || err) {
        return 'error';
      }
      return 'info';
    },
  });
}
