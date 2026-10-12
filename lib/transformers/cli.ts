import { inspect } from 'node:util';
import { createColors } from '@block65/color';
import {
  Level,
  type LogDescriptor,
  type LoggerTransformer,
} from '../logger.js';

export interface CliOptions {
  color?: boolean;
}

const colors = createColors(true);
const noColors = createColors(false);

export function cliTransformer(log: LogDescriptor,
  options: { useColor?: boolean; timestamps?: boolean } = {}): string {
  const {
    bgRed, bgYellow, black, blue, bold, dim,  green, red, whiteBright,
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

  const { level, msg, time: _, ctx, data } = log;
  const { name = null, ...ctxRest } = ctx ?? {};

  const maybeFormattedName = name !== undefined && name !== null ? `(${name}) ` : '';
  const maybeFormattedMsg = msg !== undefined && msg !==null ? `${msg.toLocaleString()} ` : '';

  const dataWithCtx = {
    ...data,
    ...(Object.keys(ctxRest).length > 0 && { ctx: ctxRest }),
  };

  const formattedData = dataWithCtx && Object.keys(dataWithCtx).length > 0
    ? `${inspect(dataWithCtx, {
      compact: true,
      breakLength: Infinity,
      sorted: true,
      depth: 6,
      ...('useColor' in options && { colors: options.useColor }),
    })}`
    : '';

  const formattedLevel = formatLevel(level).padEnd(6);
  const maybeTimestamp = options.timestamps === false ? '' : dim(`${new Date().toISOString()} `);

  return `${maybeTimestamp}${formattedLevel} ${maybeFormattedName}${maybeFormattedMsg}${formattedData}`;
}

export function createCliTransformer(options?: CliOptions): LoggerTransformer {
  const supportsColorCache = new WeakMap<WritableStream<unknown>, boolean>();

  return function cliTransformerCheckColor(log: LogDescriptor) {
    // user wants color, just do it
    if (options && 'color' in options) {
      return cliTransformer(log, { useColor: options.color });
    }

    // For WritableStream we can't detect TTY, so default to no color
    // unless explicitly set via options
    if (!supportsColorCache.has(this.destination)) {
      supportsColorCache.set(this.destination, false);
    }

    const useColor = supportsColorCache.get(this.destination) ?? false;

    return cliTransformer(log, { useColor });
  };
}
