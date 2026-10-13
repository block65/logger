import { inspect } from "loupe";
import { createColors } from "tinyrainbow";
import { Level, type LogDescriptor, type Transformer } from "../logger.ts";
import { toText } from "../utils.ts";

export type CliOptions = {
	/** ANSI colour codes in the output, off by default */
	color?: boolean | undefined;
	/** Each line starts with the log's time, on by default */
	timestamps?: boolean | undefined;
};

const colors = createColors({ force: true });

type Paint = (input: string) => string;

const levelStyles: Record<Level, { label: string; paint: Paint }> = {
	[Level.Silent]: { label: "SILENT", paint: colors.dim },
	[Level.Trace]: { label: "TRACE", paint: colors.dim },
	[Level.Debug]: { label: "DEBUG", paint: colors.green },
	[Level.Info]: { label: "INFO", paint: colors.blue },
	[Level.Warn]: {
		label: "WARN",
		paint: (s) => colors.bgYellow(colors.black(colors.bold(s))),
	},
	[Level.Error]: { label: "ERROR", paint: colors.red },
	[Level.Fatal]: {
		label: "FATAL",
		paint: (s) => colors.bgRed(colors.whiteBright(colors.bold(s))),
	},
};

// labels are padded outside the colour codes, so columns line up either way
function formatLevel(level: Level, color: boolean) {
	const { label, paint } = levelStyles[level];
	return `${color ? paint(label) : label}${" ".repeat(6 - label.length)}`;
}

/**
 * Formats a log as one human readable line, for a terminal or a console that
 * shows text
 */
export function cliTransformer(
	log: LogDescriptor,
	options: CliOptions = {},
): string {
	const { color = false, timestamps = true } = options;
	const { level, msg, time, ctx = {}, data = {} } = log;
	const { name, ...ctxRest } = ctx;

	const dataWithCtx = {
		...data,
		...(Object.keys(ctxRest).length > 0 && { ctx: ctxRest }),
	};

	return [
		timestamps && (color ? colors.dim(time.toISOString()) : time.toISOString()),
		formatLevel(level, color),
		name !== undefined && name !== null && `(${toText(name)})`,
		msg !== undefined && msg !== null && String(msg),
		Object.keys(dataWithCtx).length > 0 &&
			inspect(dataWithCtx, { colors: color, depth: 6 }),
	]
		.filter((part) => typeof part === "string")
		.join(" ");
}

export function createCliTransformer(options: CliOptions = {}): Transformer {
	return function cliTransformerWithOptions(log) {
		return cliTransformer(log, options);
	};
}
