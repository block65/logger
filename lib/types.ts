import type { Namespace } from 'cls-hooked';
import type pino from 'pino';
import type { MixinFn, MixinFnWithData } from './mixins.js';

export type Falsy = false | undefined | null;

export enum LogLevelNumbers {
  Fatal = 60,
  Error = 50,
  Warn = 40,
  Info = 30,
  Debug = 20,
  Trace = 10,
  Silent = 0,
}

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
  cls: Namespace;
}

export interface ClsContext {
  _contextId: string;
  _context?: Record<string, unknown>;
}

export type NamespaceContext = {
  id?: unknown;
  _ns_name?: unknown;
} & Partial<ClsContext>;

export type ComputePlatform = 'gcp-cloudrun' | 'aws-lambda' | 'aws';

export interface CreateLoggerOptions
  extends Omit<pino.LoggerOptions, 'mixin' | 'prettyPrint' | 'prettifier'> {
  pretty?: boolean;
  traceCaller?: boolean;
  platform?: ComputePlatform;
  mixins?: (MixinFnWithData | MixinFn | Falsy)[];
  transports?: pino.TransportMultiOptions;
}

export type CreateLoggerOptionsWithoutTransports = Omit<
  CreateLoggerOptions,
  'pretty' | 'transports'
>;

export interface CreateCliLoggerOptions
  extends Omit<CreateLoggerOptionsWithoutTransports, 'platform'> {
  color?: boolean;
}
