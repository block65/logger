import { AsyncLocalStorage } from 'async_hooks';
import type pino from 'pino';
import type { MixinFn, MixinFnWithData } from './mixins.js';
import type { PrettyTransportOptions } from './pretty-transport.js';
import type { SentryTransportOptions } from './sentry-transport.js';

export type Falsy = false | undefined | null;

export enum LogLevelNumbers {
  Fatal = 60,
  Error = 50,
  Warn = 40,
  Info = 30,
  Debug = 20,
  Trace = 10,
  Silent = Infinity,
}

export type LevelWithSilent = pino.LevelWithSilent;

export interface LogDescriptor {
  level: LogLevelNumbers;
  time: number;

  msg?: string;
  name?: string | undefined;

  // maye not be available depending on platform/cli
  pid?: number;
  hostname?: string;

  [key: string]: unknown;
}

type RemoveIndex<T> = {
  [K in keyof T as {} extends Record<K, 1> ? never : K]: T[K];
};

// pino tacks on a nasty `Record<string, any>` to its logger type
// we try to remove it here
export type BaseLogger = RemoveIndex<pino.Logger>;

export interface Logger extends BaseLogger {
  als: AsyncLocalStorage<AlsContext>;
  flushTransports: () => Promise<void>;
}

export interface AlsContext {
  id: string;
  context?: Record<string, unknown>;
}

export interface AlsContextOutput {
  _contextId: AlsContext['id'];
  _context?: AlsContext['context'];
}

export type ComputePlatform = 'gcp-cloudrun' | 'aws-lambda' | 'aws';

export interface CreateLoggerOptions
  extends Omit<
    pino.LoggerOptions,
    'mixin' | 'prettyPrint' | 'prettifier' | 'color' | 'transport' | 'level'
  > {
  prettyOptions?: boolean | PrettyTransportOptions;
  traceCaller?: boolean;
  platform?: ComputePlatform;
  mixins?: (MixinFnWithData | MixinFn | Falsy)[];
  transports?: pino.TransportMultiOptions['targets'];
  sentryTransportOptions?: SentryTransportOptions;
  level?: pino.LevelWithSilent;
}
