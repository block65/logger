import util from 'util';
import chalk from 'chalk';
import type { LogDescriptor, Logger } from './node.js';

function formatLevel(level: number) {
  switch (level) {
    case 60: //fatal
      return chalk.whiteBright.bgRed.bold('FATAL');
    case 50: //error
      return chalk.red('ERROR');
    case 40: // warn
      return chalk.bgYellow.black.bold('WARN');
    case 30: //info
      return chalk.blue('INFO');
    case 20: //debug
      return chalk.green('DEBUG');
    case 10: //trace
      return chalk.gray('TRACE');
  }
}

export function prettifier(thisArg: Logger, options: unknown) {
  return (log: LogDescriptor) => {
    const { level, msg = '', time, name, hostname, pid, ...rest } = log;

    if (msg?.startsWith('pino.final with prettyPrint')) {
      return '';
    }

    const formattedName = name ? `(${name})` : '';
    const formattedMsg = msg && ' ' + chalk.whiteBright(msg);

    const formattedRest =
      Object.keys(rest).length > 0
        ? ' ' +
          util.inspect(rest, {
            colors: true,
            compact: true,
            sorted: true,
          })
        : '';

    return `${formatLevel(level)}${formattedName}: ${chalk.gray(
      new Date(time).toJSON(),
    )}${formattedMsg}${formattedRest}\n`;
  };
}
