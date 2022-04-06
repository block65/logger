import { createColors } from 'colorette';
import util from 'util';
import { Level, type Transformer } from '../logger.js';

export interface CliOptions {
  color?: boolean;
}

export function createCliTransformer(options?: CliOptions): Transformer {
  const forceNoColor: boolean =
    process.env.TERM === 'dumb' || 'NO_COLOR' in process.env;

  const useColor = forceNoColor ? false : options?.color === true;

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
  } = createColors({ useColor });

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

  return (log) => {
    const { level, msg = '', time, ctx = {}, data } = log;
    const { name } = ctx;

    const formattedName = name ? `(${name})` : '';
    const formattedMsg = msg && ` ${bold(msg)}`;

    const formattedData =
      data && Object.keys(data).length > 0
        ? ` ${util.inspect(data, {
            colors: useColor,
            compact: true,
            sorted: true,
            depth: 6,
          })}`
        : '';

    return `${gray(new Date(time).toJSON())} ${formatLevel(level).padEnd(
      6,
      ' ',
    )}${formattedName} ${formattedMsg}${formattedData}`;
  };
}
