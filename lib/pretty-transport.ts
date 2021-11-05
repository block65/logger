import { createColors } from 'colorette';
import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { isatty } from 'tty';
import util from 'util';
import type { LogDescriptor } from './types.js';

export interface PrettyTransportOptions {
  destination: number | SonicBoomOpts['dest'];
}

export function createPrettifier(options?: { fd?: number; color?: boolean }) {
  const forceNoColor: boolean =
    process.env.TERM === 'dumb' || 'NO_COLOR' in process.env;

  const useColor = forceNoColor
    ? false
    : options?.color === true || (!!options?.fd && isatty(options.fd));

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
      case 60: // LogLevelNumbers.Fatal:
        return bgRed(whiteBright(bold('FATAL')));
      case 50: // LogLevelNumbers.Error:
        return red('ERROR');
      case 40: //LogLevelNumbers.Warn:
        return bgYellow(black(bold('WARN')));
      case 30: // LogLevelNumbers.Info:
        return blue('INFO');
      case 20: // LogLevelNumbers.Debug:
        return green('DEBUG');
      case 10: // LogLevelNumbers.Trace:
        return dim('TRACE');
      case 0: // LogLevelNumbers.Silent:
      default:
        return dim('SILENT');
    }
  };

  return (log: LogDescriptor): string => {
    const { level, msg = '', time, name, hostname, pid, ...rest } = log;

    const formattedName = name ? `(${name})` : '';
    const formattedMsg = msg && ' ' + bold(msg);

    const formattedRest =
      Object.keys(rest).length > 0
        ? ' ' +
          util.inspect(rest, {
            colors: useColor,
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

export default async function (options: PrettyTransportOptions) {
  const fd =
    typeof options.destination === 'number' ? options.destination : undefined;

  const prettifier = createPrettifier({ fd });

  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom({
    fd,
    dest:
      typeof options.destination !== 'number' && options.destination
        ? options.destination
        : undefined,
    sync: false,
  });

  await once(destination, 'ready');

  return build(
    async function (source) {
      for await (let obj of source) {
        const toDrain = !destination.write(prettifier(obj) + '\n');
        // This block will handle backpressure
        if (toDrain) {
          await once(destination, 'drain');
        }
      }
    },
    {
      async close(err?: Error) {
        if (err) {
          console.warn(err);
        }
        destination.end();

        await once(destination, 'close');
      },
    },
  );
}
