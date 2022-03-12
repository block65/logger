import { AsyncLocalStorage } from 'async_hooks';
import { Worker } from 'node:worker_threads';
import type pino from 'pino';
import type { SetRequired, JsonObject } from 'type-fest';
import type { MixinFn, MixinFnWithData } from './mixins.js';
import type { SentryTransportOptions } from './transports/sentry.js';

type VoidFunction = () => void | Promise<void>;

// awaiting https://github.com/pinojs/thread-stream/issues/24
export interface ThreadStream {
  worker: Worker;
  write(data: any): boolean;
  end(): void;
  flush(cb: VoidFunction): void;
  flushSync(): void;
  unref(): void;
  ref(): void;
  get ready(): any;
  get destroyed(): any;
  get closed(): any;
  get writable(): boolean;
  get writableEnded(): any;
  get writableFinished(): any;
  get writableNeedDrain(): any;
  get writableObjectMode(): boolean;
  get writableErrored(): any;
}

// pino.LoggerOptions but with all the bad stuff removed
export type PinoLoggerOptions = Omit<
  pino.LoggerOptions,
  'prettyPrint' | 'prettifier' | 'color' | 'browser'
> & {
  level?: pino.LevelWithSilent;
};

export type PinoLoggerOptionsWithLevel = PinoLoggerOptions &
  SetRequired<PinoLoggerOptions, 'level'>;

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

export interface LogDescriptor extends Partial<AlsContextOutput> {
  level: LogLevelNumbers;
  time: number;

  msg?: string;
  name?: string | undefined;

  // may not be available depending on platform and logFormat
  pid?: number;
  hostname?: string;

  ctx?: { [key: string]: unknown };

  [key: string]: unknown;
}

type RemoveIndex<T> = {
  [K in keyof T as {} extends Record<K, 1> ? never : K]: T[K];
};

// pino tacks on a nasty `Record<string, any>` to its logger type
// preumably for custom error levels, we try to remove it here
export type BaseLogger = RemoveIndex<pino.Logger>;

export interface Logger extends BaseLogger {
  als: AsyncLocalStorage<AlsContext>;
  flushTransports: () => Promise<void>;
  // end: () => void;
}

export interface AlsContext {
  id: string;
  context?: JsonObject;
}

export interface AlsContextOutput {
  _contextId: AlsContext['id'];
  _context?: AlsContext['context'];
}

export type LogFormat = 'gcp' | 'aws-cloudwatch' | 'cli' | 'json';
export type Platform = 'gcp-cloudrun' | 'aws-lambda' | 'aws-ecs' | 'unknown';

export interface CreateLoggerOptions
  extends Omit<PinoLoggerOptions, 'mixin' | 'transport' | 'level'> {
  traceCaller?: boolean;
  mixins?: (MixinFnWithData | MixinFn | Falsy)[];
  logFormat?: LogFormat;
  platform?: Platform;
  sentryTransportOptions?: SentryTransportOptions;
  level?: pino.LevelWithSilent;
}
