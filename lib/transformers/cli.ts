import { Writable } from 'node:stream';
import { inspect } from 'node:util';
import { createColors } from 'colorette';
import type { JsonObject } from 'type-fest';
import {
  Level,
  type LogDescriptor,
  type LoggerTransformer,
} from '../logger.js';

export interface CliOptions {
  color?: boolean;
}

const colors = createColors({ useColor: true });
const noColors = createColors({ useColor: false });

export const cliTransformer = function cliTransformer(
  log: LogDescriptor,
  options: { useColor?: boolean } = {},
): string {
  const {
    bgRed,
    bgYellow,
    black,
    blue,
    bold,
    dim,
    gray,
    green,
    red,
    whiteBright,
  } = options.useColor ? colors : noColors;

  const formatLevel = (level: number): string => {
    switch (level) {
      case Level.Fatal:
        return bgRed(whiteBright(bold('FATAL')));
      case Level.Error:
        return red('ERROR');
      case Level.Warn:
        return bgYellow(black(bold('WARN')));
      case Level.Info:
        return blue('INFO');
      case Level.Debug:
        return green('DEBUG');
      case Level.Trace:
        return dim('TRACE');
      case Level.Silent:
      default:
        return dim('SILENT');
    }
  };

  const { level, msg, time, ctx, data } = log;
  const { name = null, ...ctxRest } = { ...ctx };

  const maybeFormattedName = name ? `(${name}) ` : '';
  const maybeFormattedMsg = msg ? `${bold(msg.toLocaleString())} ` : '';

  const dataWithCtx = {
    ...data,
    ...(Object.keys(ctxRest).length > 0 && { ctx: ctxRest }),
  };

  const formattedData =
    dataWithCtx && Object.keys(dataWithCtx).length > 0
      ? `${inspect(dataWithCtx, {
          compact: true,
          breakLength: Infinity,
          sorted: true,
          depth: 6,
          ...('useColor' in options && { colors: options.useColor }),
        })}`
      : '';

  const formattedLevel = formatLevel(level).padEnd(6);
  const formattedDate = gray(new Date(time).toJSON());

  return `${formattedDate} ${formattedLevel} ${maybeFormattedName}${maybeFormattedMsg}${formattedData}\n`;
};

export const createCliTransformer = (
  options?: CliOptions,
): LoggerTransformer => {
  const supportsColorCache = new WeakMap<Writable, boolean>();

  return function cliTransformerCheckColor(log: LogDescriptor) {
    // user wants color, just do it
    if (options && 'color' in options) {
      return cliTransformer(log, { useColor: options.color });
    }

    // try to work it out from the destination
    // only a `WriteStream` can be checked, otherwise you get no color.
    if (!supportsColorCache.has(this.destination)) {
      const destHasColor =
        'isTTY' in this.destination ? this.destination.hasColors() : false;

      supportsColorCache.set(this.destination, destHasColor);
    }

    const useColor = supportsColorCache.get(this.destination) || false;

    return cliTransformer(log, { useColor });
  };
};
