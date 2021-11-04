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
import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { isatty } from 'tty';
import util from 'util';
import { LogDescriptor } from './types.js';

export interface PrettyTransportOptions {
  destination?: number | SonicBoomOpts['dest'];
}

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

export function createPrettifier(/*options?: unknown*/) {
  return (log: LogDescriptor): string => {
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
            colors:
              'FORCE_COLOR' in process.env ||
              (isatty(1) &&
                process.env.TERM !== 'dumb' &&
                !('NO_COLOR' in process.env)),
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

export default async function (options?: PrettyTransportOptions) {
  const prettifier = createPrettifier();
  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom({
    fd:
      typeof options?.destination === 'number'
        ? options?.destination
        : undefined,
    dest:
      typeof options?.destination !== 'number'
        ? options?.destination?.toString()
        : undefined,
    sync: true,
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
