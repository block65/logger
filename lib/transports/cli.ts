import { createColors } from 'colorette';
import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { isatty } from 'tty';
import util from 'util';
import { LogDescriptor, LogLevelNumbers } from '../types.js';

// must be serialiazable so it can get passed to a worker
export interface CliTransportOptions extends SonicBoomOpts {
  color?: boolean;
}

export function levelNumberToCliStringMap(level: LogLevelNumbers): string {
  switch (level) {
    case LogLevelNumbers.Fatal:
      return 'FATAL';
    case LogLevelNumbers.Error:
      return 'ERROR';
    case LogLevelNumbers.Warn:
      return 'WARN';
    case LogLevelNumbers.Info:
      return 'INFO';
    case LogLevelNumbers.Debug:
      return 'DEBUG';
    case LogLevelNumbers.Trace:
      return 'TRACE';
    case LogLevelNumbers.Silent:
    default:
      return 'SILENT';
  }
}

function createTransformer(options?: {
  fd?: number;
  color?: boolean;
}): (log: LogDescriptor) => string {
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

  const formatLevel = (level: LogLevelNumbers): string => {
    const levelName = levelNumberToCliStringMap(level);
    switch (level) {
      case LogLevelNumbers.Fatal:
        return bgRed(whiteBright(bold(levelName)));
      case LogLevelNumbers.Error:
        return red(levelName);
      case LogLevelNumbers.Warn:
        return bgYellow(black(bold(levelName)));
      case LogLevelNumbers.Info:
        return blue(levelName);
      case LogLevelNumbers.Debug:
        return green(levelName);
      case LogLevelNumbers.Trace:
      case LogLevelNumbers.Silent:
      default:
        return dim(levelName);
    }
  };

  return (log) => {
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

export async function cliTransport({
  color,
  ...sonicBoomOpts
}: CliTransportOptions) {
  const dest =
    typeof sonicBoomOpts.dest === 'string' ? sonicBoomOpts.dest : undefined;

  const fallbackFd = !dest ? process.stdout.fd : undefined;

  const fd =
    typeof sonicBoomOpts.dest === 'number' ? sonicBoomOpts.dest : fallbackFd;

  const transformer = createTransformer({ fd, color });

  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom(sonicBoomOpts);

  await once(destination, 'ready');

  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const obj of source) {
        const toDrain = !destination.write(`${transformer(obj)}\n`);
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

export default cliTransport;
