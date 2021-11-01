import type { Namespace } from 'cls-hooked';
import type pino from 'pino';

export interface LogDescriptor {
  level: number;
  msg?: string;
  name?: string | undefined;
  time: number;
  pid: number;
  hostname: string;

  [key: string]: unknown;
}

export type BaseLogger = pino.BaseLogger & pino.LoggerExtras;

export type Logger = {
  cls: Namespace;
} & BaseLogger;
