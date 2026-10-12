import Emittery, {
	type EmitteryEvent,
	type UnsubscribeFunction,
} from "emittery";
import format from "quick-format-unescaped";
import { serializeError } from "serialize-error";
import type { Jsonifiable, JsonPrimitive } from "type-fest";
import { isPlainObject, safeStringify, withNullProto } from "./utils.ts";

export type JsonifiableObject = { [Key in string]?: Jsonifiable };

export type Level = 0 | 10 | 20 | 30 | 40 | 50 | 60;

// named like the enum it replaces, so `Level.Info` reads the same to callers
// oxlint-disable-next-line block65/no-pascal-case-variable
export const Level = Object.freeze({
	Silent: 0,
	Trace: 10,
	Debug: 20,
	Info: 30,
	Warn: 40,
	Error: 50,
	Fatal: 60,
} satisfies Record<string, Level>);

export type LevelAsString = Lowercase<keyof typeof Level>;

const stringLevelMap = new Map<string, Level>([
	["silent", Level.Silent],
	["trace", Level.Trace],
	["debug", Level.Debug],
	["info", Level.Info],
	["warn", Level.Warn],
	["error", Level.Error],
	["fatal", Level.Fatal],
]);

/**
 * Looks up a level by name, ignoring case, and gives `undefined` for an
 * unknown name
 */
export function parseLevel(level: string | undefined): Level | undefined {
	return level === undefined
		? undefined
		: stringLevelMap.get(level.toLowerCase());
}

// holds the caller's own values, which transformers stringify safely
export type LogData = Record<string, unknown>;

export type LogDescriptor = {
	time: Date;
	level: Level;
	msg?: JsonPrimitive;
	ctx?: JsonifiableObject;
	data?: LogData;
	err?: unknown;
};

/**
 * Takes a log and returns it changed, for the next processor or the transformer
 */
export type Processor = (
	this: Logger,
	log: LogDescriptor,
) => LogDescriptor | Promise<LogDescriptor>;

/**
 * Turns a log into what the destination receives, usually one line of text
 */
export type Transformer = (this: Logger, log: LogDescriptor) => unknown;

export type LoggerOptions = {
	destination: WritableStream<unknown>;
	level?: Level | undefined;
	processors?: Processor[] | undefined;
	transformer?: Transformer | undefined;
	context?: JsonifiableObject | undefined;
};

export type CreateLoggerOptions = Partial<LoggerOptions>;

export type ChildLoggerOptions = Pick<
	LoggerOptions,
	"level" | "context" | "processors"
>;

export type LogMethod = {
	(err: unknown, str?: JsonPrimitive, ...args: unknown[]): void;
	(data: JsonifiableObject, str?: JsonPrimitive, ...args: unknown[]): void;
	(str: JsonPrimitive, ...args: unknown[]): void;
};

export type LoggerEvents = {
	log: LogDescriptor;
	error: unknown;
	flush: undefined;
	end: undefined;
};

type LoggerEventName = keyof LoggerEvents;

type LoggerEventListener<Name extends LoggerEventName> = (
	event: EmitteryEvent<Name, LoggerEvents[Name]>,
) => void | Promise<void>;

function isPrimitive(value: unknown): value is JsonPrimitive {
	return (
		value === null ||
		(value !== undefined &&
			typeof value !== "object" &&
			typeof value !== "function")
	);
}

function formatMessage(template: unknown, args: unknown[], fallback: unknown) {
	if (typeof template === "string") {
		return format(template, args, { stringify: safeStringify });
	}

	// a primitive, or an object the caller chose to log as the message
	// oxlint-disable-next-line typescript/no-base-to-string
	return fallback === undefined ? undefined : String(fallback);
}

function hasToJSON(value: unknown): value is { toJSON: () => unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		"toJSON" in value &&
		typeof value.toJSON === "function"
	);
}

// every argument is unknown because callers log values of any type
function toLogDescriptor(
	level: Level,
	arg1: unknown,
	arg2?: unknown,
	...args: unknown[]
): LogDescriptor {
	const time = new Date();

	if (arg1 instanceof Error) {
		return {
			time,
			level,
			msg: typeof arg2 === "string" ? arg2 : arg1.message,
			data: {
				err: serializeError(arg1),
			},
			err: arg1,
		};
	}

	if (isPrimitive(arg1)) {
		return {
			time,
			level,
			msg: format(String(arg1), [arg2, ...args], {
				stringify: safeStringify,
			}),
		};
	}

	if (Array.isArray(arg1)) {
		const msg = formatMessage(arg2, args, arg2);

		return {
			time,
			level,
			...(msg && { msg }),
			data: Object.fromEntries(arg1.map((value, idx) => [idx, value])),
		};
	}

	if (isPlainObject(arg1)) {
		const { err, ...data } = arg1;
		const msg = formatMessage(arg2, args, arg2);

		if (err instanceof Error) {
			return {
				time,
				level,
				...(msg && { msg }),
				err,
				data: withNullProto({
					err: serializeError(err),
					...data,
				}),
			};
		}

		return {
			time,
			level,
			...(msg && { msg }),
			data: arg1,
		};
	}

	const msg = formatMessage(arg2, args, arg1);

	// Buffer and similar objects describe themselves through toJSON
	if (hasToJSON(arg1)) {
		return {
			time,
			level,
			...(msg && { msg }),
			data: Object(arg1.toJSON()),
		};
	}

	return {
		time,
		level,
		...(msg && { msg }),
	};
}

export class Logger {
	// a symbol written here is a marker, and flush() resolves when the marker
	// reaches the end of the pipeline
	readonly #input: WritableStreamDefaultWriter<LogDescriptor | symbol>;

	readonly #flushCallbacks = new Map<symbol, () => void>();

	readonly #abortController = new AbortController();

	readonly #pipeline: Promise<void>;

	readonly #emitter = new Emittery<LoggerEvents>();

	readonly #context: JsonifiableObject | undefined;

	readonly #childLoggers = new Set<Logger>();

	#ended = false;

	#destroyed = false;

	public level: Level;

	public readonly destination: WritableStream<unknown>;

	public constructor(options: LoggerOptions) {
		const {
			level = Level.Info,
			transformer,
			processors = [],
			destination,
			context,
		} = options;

		this.#context = context && withNullProto(context);
		this.level = level;
		this.destination = destination;

		const input = new TransformStream<
			LogDescriptor | symbol,
			LogDescriptor | symbol
		>();
		this.#input = input.writable.getWriter();

		const processorTransform = new TransformStream<
			LogDescriptor | symbol,
			unknown
		>({
			transform: async (chunk, controller) => {
				if (typeof chunk === "symbol") {
					controller.enqueue(chunk);

					return;
				}

				const processed = await this.#process(chunk, processors);

				if (!transformer) {
					controller.enqueue(processed);

					return;
				}

				try {
					const output: unknown = await transformer.call(this, processed);
					controller.enqueue(output);
				} catch (err) {
					// the log is dropped, because only the transformer can format it
					await this.#emitError(err);
				}
			},
		});

		const pipeCleanerTransform = new TransformStream<unknown, unknown>({
			transform: (chunk, controller) => {
				if (typeof chunk === "symbol") {
					this.#flushCallbacks.get(chunk)?.();
					this.#flushCallbacks.delete(chunk);
					return;
				}
				controller.enqueue(chunk);
			},
		});

		this.#pipeline = input.readable
			.pipeThrough(processorTransform)
			.pipeThrough(pipeCleanerTransform)
			.pipeTo(destination, { signal: this.#abortController.signal })
			.catch((err: unknown) => {
				if (!this.#abortController.signal.aborted) {
					void this.#emitError(err);
				}
			});
	}

	// a processor that throws is skipped, and the next one gets its input
	async #process(log: LogDescriptor, processors: Processor[]) {
		let current = log;
		for (const processor of processors) {
			try {
				// each processor takes the output of the one before it
				// oxlint-disable-next-line eslint/no-await-in-loop
				current = await processor.call(this, current);
			} catch (err) {
				void this.#emitError(err);
			}
		}

		return current;
	}

	// resolves even when a listener throws, so callers can leave it unawaited
	async #emitError(err: unknown) {
		try {
			await this.#emitter.emit("error", err);
		} catch {
			// a listener for "error" threw, and reporting it would loop
		}
	}

	#warnIfDestroyed() {
		if (this.#destroyed) {
			console.warn("Logger has been destroyed and cannot be used");
		}
	}

	#enqueue(chunk: LogDescriptor | symbol) {
		if (this.#ended || this.#destroyed) {
			return;
		}

		this.#input.write(chunk).catch((err: unknown) => this.#emitError(err));
	}

	#write(level: Level, arg1: unknown, arg2?: unknown, ...args: unknown[]) {
		this.#warnIfDestroyed();

		if (level < this.level) {
			return;
		}

		const log: LogDescriptor = Object.freeze({
			...toLogDescriptor(level, arg1, arg2, ...args),
			...(this.#context && { ctx: { ...this.#context } }),
		});

		this.#enqueue(log);
		this.#emitter
			.emit("log", log)
			.catch((err: unknown) => this.#emitError(err));
	}

	public get destroyed(): boolean {
		return this.#destroyed;
	}

	public setLevel(level: Level): void {
		this.level = level;
	}

	/**
	 * A logger that adds `data` to each log, then sends it through this
	 * logger's processors and transformer. Its level defaults to this logger's
	 * level, and its context replaces this logger's context
	 */
	public child(
		data: JsonifiableObject,
		options: ChildLoggerOptions = {},
	): Logger {
		this.#warnIfDestroyed();

		const { level = this.level, processors = [], context } = options;

		const destination = new WritableStream<LogDescriptor | symbol>({
			write: (chunk) => {
				this.#enqueue(chunk);
			},
		});

		const child = new Logger({
			level,
			destination,
			context,
			processors: [
				function childLoggerProcessor(log) {
					return {
						...log,
						data: {
							...log.data,
							...data,
						},
					};
				},
				...processors,
			],
		});

		this.#childLoggers.add(child);

		child.on("end", () => {
			this.#childLoggers.delete(child);
		});

		return child;
	}

	/**
	 * Resolves when every log written so far, by this logger and its children,
	 * has reached the destination
	 */
	public flush = async (): Promise<void> => {
		if (this.#destroyed) {
			return;
		}

		await Promise.all(
			[...this.#childLoggers].map(async (child) => child.flush()),
		);

		if (this.#ended) {
			return;
		}

		const pipeCleaner = Symbol("pipe-cleaner");

		await new Promise<void>((resolve) => {
			this.#flushCallbacks.set(pipeCleaner, resolve);
			this.#enqueue(pipeCleaner);
		});

		await this.#emitter
			.emit("flush")
			.catch((err: unknown) => this.#emitError(err));
	};

	/**
	 * Flushes, then closes the destination. Later logs are dropped
	 */
	public end = async (): Promise<void> => {
		if (this.#destroyed || this.#ended) {
			return;
		}

		await Promise.all(
			[...this.#childLoggers].map(async (child) => child.end()),
		);

		await this.flush();

		this.#ended = true;

		await this.#input.close().catch((err: unknown) => this.#emitError(err));
		await this.#pipeline;

		await this.#emitter
			.emit("end")
			.catch((err: unknown) => this.#emitError(err));

		this.#emitter.clearListeners();
	};

	/**
	 * Flushes, then aborts the destination and removes every listener and
	 * child logger
	 */
	public destroy = async (): Promise<void> => {
		if (this.#destroyed) {
			return;
		}

		await Promise.all(
			[...this.#childLoggers].map(async (child) => child.destroy()),
		);

		await this.flush();

		this.#destroyed = true;
		this.#ended = true;

		this.#abortController.abort();

		await this.#pipeline;

		this.#emitter.clearListeners();
		this.#childLoggers.clear();
		this.#flushCallbacks.clear();
	};

	public on<Name extends LoggerEventName>(
		event: Name | readonly Name[],
		fn: LoggerEventListener<Name>,
	): UnsubscribeFunction {
		return this.#emitter.on(event, fn);
	}

	public off<Name extends LoggerEventName>(
		event: Name | readonly Name[],
		fn: LoggerEventListener<Name>,
	): void {
		this.#emitter.off(event, fn);
	}

	public trace: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Trace, ...args);
	};

	public debug: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Debug, ...args);
	};

	public info: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Info, ...args);
	};

	public warn: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Warn, ...args);
	};

	public error: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Error, ...args);
	};

	public fatal: LogMethod = (...args: [unknown, unknown?, ...unknown[]]) => {
		this.#write(Level.Fatal, ...args);
	};
}
