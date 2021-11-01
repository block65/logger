import {
  bgRed,
  bgYellow,
  black,
  blue,
  bold,
  gray,
  green,
  red,
  whiteBright,
} from 'colorette';
import util from 'util';
import type { LogDescriptor, Logger } from './types.js';

function formatLevel(level: number): string {
  switch (level) {
    case 60: //fatal
      return whiteBright(bgRed(bold('FATAL')));
    case 50: //error
      return red('ERROR');
    case 40: // warn
      return bgYellow(black(bold('WARN')));
    case 30: //info
      return blue('INFO');
    case 20: //debug
      return green('DEBUG');
    case 10: //trace
      return gray('TRACE');
    default:
      return gray('SILENT');
  }
}

export function prettifier(thisArg: Logger, options: unknown) {
  return (log: LogDescriptor) => {
    const { level, msg = '', time, name, hostname, pid, ...rest } = log;

    if (msg?.startsWith('pino.final with prettyPrint')) {
      return '';
    }

    const formattedName = name ? `(${name})` : '';
    const formattedMsg = msg && ' ' + whiteBright(msg);

    const formattedRest =
      Object.keys(rest).length > 0
        ? ' ' +
          util.inspect(rest, {
            colors: true,
            compact: true,
            sorted: true,
          })
        : '';

    return `${gray(new Date(time).toJSON())} ${formatLevel(level).padEnd(
      6,
      ' ',
    )}${formattedName} ${formattedMsg}${formattedRest}\n`;
  };
}
