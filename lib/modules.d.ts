declare module 'pino-abstract-transport' {
  import pino from 'pino';
  import { Readable } from 'stream';
  export default function (
    fn: (source: Readable) => Promise<void>,
    options?: {
      parse?: 'lines';
      parseLine?: (line: string) => pino.LogDescriptor;
      close?: ((err) => Promise<void>) | ((err, cb) => void);
    },
  ): Readable;
}
