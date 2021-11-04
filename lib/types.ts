import type { Namespace } from 'cls-hooked';
import type pino from 'pino';

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

export type BaseLogger = pino.BaseLogger & pino.LoggerExtras;

export type Logger = {
  cls: Namespace;
} & BaseLogger;
