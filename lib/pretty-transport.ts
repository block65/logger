import { createColors } from 'colorette';
import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { isatty } from 'tty';
import util from 'util';
import { LogDescriptor, LogLevelNumbers } from './types.js';

// must be serialiazable so it can get passed to a worker
export interface PrettyTransportOptions {
  destination?: SonicBoomOpts['dest'];
  color?: boolean;
}

function createPrettifier(options?: { fd?: number; color?: boolean }) {
  const forceNoColor: boolean =
    process.env.TERM === 'dumb' ||
    'NO_COLOR' in process.env ||
    options?.color === false;

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
      case LogLevelNumbers.Fatal:
        return bgRed(whiteBright(bold('FATAL')));
      case LogLevelNumbers.Error:
        return red('ERROR');
      case LogLevelNumbers.Warn:
        return bgYellow(black(bold('WARN')));
      case LogLevelNumbers.Info:
        return blue('INFO');
      case LogLevelNumbers.Debug:
        return green('DEBUG');
      case LogLevelNumbers.Trace:
        return dim('TRACE');
      case LogLevelNumbers.Silent:
      default:
        return dim('SILENT');
    }
  };

  return (log: LogDescriptor): string => {
    const { level, msg = '', time, name, hostname, pid, ...rest } = log;

    const formattedName = name ? `(${name})` : '';
    const formattedMsg = msg && ` ${bold(msg)}`;

    const formattedRest =
      Object.keys(rest).length > 0
        ? ` ${util.inspect(rest, {
            colors: useColor,
            compact: true,
            sorted: true,
          })}`
        : '';

    return `${gray(new Date(time).toJSON())} ${formatLevel(level).padEnd(
      6,
      ' ',
    )}${formattedName} ${formattedMsg}${formattedRest}`;
  };
}

export async function prettyTransport(options: PrettyTransportOptions = {}) {
  const dest =
    typeof options.destination === 'string' ? options.destination : undefined;

  const fallbackFd = !dest ? process.stdout.fd : undefined;

  const fd =
    typeof options.destination === 'number' ? options.destination : fallbackFd;

  const prettifier = createPrettifier({ fd, color: options.color });

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

  // await once(destination, 'ready');

  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const obj of source) {
        const toDrain = !destination.write(`${prettifier(obj)}\n`);
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

export default prettyTransport;
