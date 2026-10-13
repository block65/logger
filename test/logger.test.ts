import { assert, describe, expect, test, vi } from "vitest";
import { Level, Logger, parseLevel, type LogDescriptor } from "../lib/index.ts";
import { createCapture, createTestLogger } from "./helpers.ts";

describe("log arguments", () => {
	test("a string is a printf style template for the rest", async () => {
		const { logger, logs } = createTestLogger();

		logger.info("hello %s, %d times %j", "world", 3, { a: 1 });
		await logger.end();

		expect(logs).toMatchObject([
			{ level: Level.Info, msg: 'hello world, 3 times {"a":1}' },
		]);
		expect(logs[0]?.time).toBeInstanceOf(Date);
	});

	test("an object becomes data, and a string after it the message", async () => {
		const { logger, logs } = createTestLogger();

		logger.warn({ user: "max", count: 2 }, "saw %s", "it");
		await logger.end();

		expect(logs).toMatchObject([
			{ level: Level.Warn, msg: "saw it", data: { user: "max", count: 2 } },
		]);
	});

	test("an error gives its message, a serialized copy and the original", async () => {
		const { logger, logs } = createTestLogger();
		const err = Object.assign(new TypeError("bad input"), { code: "E_BAD" });

		logger.error(err);
		logger.error(err, "while parsing %s", "config.json");
		await logger.end();

		const [first, second] = logs;
		assert(first && second);
		expect(first.msg).toBe("bad input");
		expect(second.msg).toBe("while parsing config.json");
		expect(first.err).toBe(err);
		expect(first.data?.err).toMatchObject({
			name: "TypeError",
			message: "bad input",
			code: "E_BAD",
		});
		expect(first.data?.err).not.toBeInstanceOf(Error);
	});

	test("an error under the err key is serialized beside the other data", async () => {
		const { logger, logs } = createTestLogger();
		const err = new Error("nope");

		logger.error({ err, requestId: "r1" }, "request failed");
		await logger.end();

		const [log] = logs;
		assert(log);
		expect(log.err).toBe(err);
		expect(log.msg).toBe("request failed");
		expect(log.data).toMatchObject({
			requestId: "r1",
			err: { message: "nope" },
		});
	});

	test("an array becomes data keyed by index", async () => {
		const { logger, logs } = createTestLogger();

		logger.info(["a", "b"]);
		await logger.end();

		expect(logs[0]?.data).toStrictEqual({ 0: "a", 1: "b" });
	});

	test("an object with toJSON is logged as what toJSON returns", async () => {
		const { logger, logs } = createTestLogger();

		class Point {
			public toJSON() {
				return { x: 1, y: 2 };
			}
		}

		logger.info(new Point());
		await logger.end();

		expect(logs[0]?.data).toStrictEqual({ x: 1, y: 2 });
	});

	test("primitives become the message", async () => {
		const { logger, logs } = createTestLogger();

		logger.info(123);

		// a caller can log null, and it becomes the message "null"
		// oxlint-disable-next-line unicorn/no-null
		logger.info(null);
		logger.info(false);
		await logger.end();

		expect(logs.map((log) => log.msg)).toStrictEqual(["123", "null", "false"]);
	});

	test("circular data and bigints are formatted without throwing", async () => {
		const { logger, logs, errors } = createTestLogger();
		const circular: Record<string, unknown> = { name: "loop" };
		circular.self = circular;

		logger.info("value %j and %j", circular, 10n);
		await logger.end();

		expect(logs[0]?.msg).toBe(
			'value {"name":"loop","self":"[Circular]"} and 10',
		);
		expect(errors).toStrictEqual([]);
	});

	test("the types reject a second argument that is not a message", () => {
		const { logger } = createTestLogger();

		expect(() => {
			// @ts-expect-error the second argument is a message, not more data
			logger.trace({ a: 1 }, { b: 2 });
			// @ts-expect-error the second argument is a message, not bytes
			logger.trace({ a: 1 }, new Uint8Array(1));
		}).not.toThrow();
	});
});

describe("levels", () => {
	test("logs below the logger level are dropped", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const logger = new Logger({ destination, level: Level.Warn });

		logger.trace("t");
		logger.debug("d");
		logger.info("i");
		logger.warn("w");
		logger.error("e");
		logger.fatal("f");
		await logger.end();

		expect(chunks.map((log) => log.msg)).toStrictEqual(["w", "e", "f"]);
	});

	test("the level defaults to info", () => {
		const { destination } = createCapture();

		expect(new Logger({ destination }).level).toBe(Level.Info);
		expect(new Logger({ destination, level: undefined }).level).toBe(
			Level.Info,
		);
	});

	test("setLevel applies to later logs", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const logger = new Logger({ destination, level: Level.Fatal });

		logger.info("before");
		logger.setLevel(Level.Trace);
		logger.info("after");
		await logger.end();

		expect(chunks.map((log) => log.msg)).toStrictEqual(["after"]);
	});

	test("parseLevel reads level names in any case", () => {
		expect(parseLevel("info")).toBe(Level.Info);
		expect(parseLevel("WARN")).toBe(Level.Warn);
		expect(parseLevel("Silent")).toBe(Level.Silent);
		expect(parseLevel("verbose")).toBeUndefined();
		expect(parseLevel(undefined)).toBeUndefined();
	});
});

describe("context", () => {
	test("is added to every log as ctx", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const context = { service: "api" };
		const logger = new Logger({ destination, context });

		logger.info("one");
		logger.info("two");
		await logger.end();

		expect(chunks.map((log) => log.ctx)).toStrictEqual([
			{ service: "api" },
			{ service: "api" },
		]);
		expect(chunks[0]?.ctx).not.toBe(chunks[1]?.ctx);
	});
});

describe("processors and transformer", () => {
	test("processors run in order, each taking the previous output", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const logger = new Logger({
			destination,
			processors: [
				(log) => ({ ...log, msg: `${String(log.msg)} first` }),
				async (log) => ({ ...log, msg: `${String(log.msg)} second` }),
			],
		});

		logger.info("go");
		await logger.end();

		expect(chunks[0]?.msg).toBe("go first second");
	});

	test("a processor that throws is skipped and its error reported", async () => {
		const failure = new Error("processor failed");
		const { chunks, destination } = createCapture<LogDescriptor>();
		const logger = new Logger({
			destination,
			processors: [
				() => {
					throw failure;
				},
				(log) => ({ ...log, msg: "still processed" }),
			],
		});
		const onError = vi.fn<(err: unknown) => void>();
		logger.on("error", ({ data }) => onError(data));

		logger.info("go");
		await logger.end();

		expect(chunks.map((log) => log.msg)).toStrictEqual(["still processed"]);
		expect(onError).toHaveBeenCalledWith(failure);
	});

	test("the transformer output is what reaches the destination", async () => {
		const { chunks, destination } = createCapture<string>();
		const logger = new Logger({
			destination,
			transformer: (log) => `${String(log.level)}:${String(log.msg)}`,
		});

		logger.info("a");
		logger.warn("b");
		await logger.end();

		expect(chunks).toStrictEqual(["30:a", "40:b"]);
	});

	test("a log whose transformer throws is dropped and the error reported", async () => {
		const { chunks, destination } = createCapture<string>();
		const logger = new Logger({
			destination,
			transformer: (log) => {
				assert(log.msg !== "bad", "cannot format");
				return String(log.msg);
			},
		});
		const onError = vi.fn<(err: unknown) => void>();
		logger.on("error", ({ data }) => onError(data));

		logger.info("good");
		logger.info("bad");
		logger.info("good again");
		await logger.end();

		expect(chunks).toStrictEqual(["good", "good again"]);
		expect(onError).toHaveBeenCalledOnce();
	});

	test("processors and transformer run with the logger as this", async () => {
		const { destination } = createCapture();
		const seen: unknown[] = [];
		const logger = new Logger({
			destination,
			processors: [
				function processor(this: Logger, log) {
					seen.push(this);
					return log;
				},
			],
			transformer(log) {
				seen.push(this);
				return log;
			},
		});

		logger.info("go");
		await logger.end();

		expect(seen).toStrictEqual([logger, logger]);
	});
});

describe("lifecycle", () => {
	test("flush resolves after slow processors have delivered every log", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const logger = new Logger({
			destination,
			processors: [
				async (log) => {
					await new Promise((resolve) => {
						setTimeout(resolve, 5);
					});
					return log;
				},
			],
		});

		logger.info("one");
		logger.info("two");
		await logger.flush();

		expect(chunks).toHaveLength(2);

		logger.info("three");
		await logger.flush();

		expect(chunks.map((log) => log.msg)).toStrictEqual(["one", "two", "three"]);
	});

	test("every log arrives in order under high volume", async () => {
		const { logger, logs } = createTestLogger();
		const count = 20_000;

		Array.from({ length: count }, (_, i) => logger.info({ i }, "n %d", i));
		await logger.end();

		expect(logs).toHaveLength(count);
		expect(logs.map((log) => log.data?.i)).toStrictEqual(
			Array.from({ length: count }, (_, i) => i),
		);
	});

	test("end closes the destination and drops later logs", async () => {
		const close = vi.fn<() => void>();
		const chunks: unknown[] = [];
		const destination = new WritableStream({
			write(chunk) {
				chunks.push(chunk);
			},
			close,
		});
		const logger = new Logger({ destination });
		const onEnd = vi.fn<() => void>();
		logger.on("end", onEnd);

		logger.info("kept");
		await logger.end();
		logger.info("dropped");
		await logger.flush();
		await logger.end();

		expect(chunks).toHaveLength(1);
		expect(close).toHaveBeenCalledOnce();
		expect(onEnd).toHaveBeenCalledOnce();
	});

	test("destroy aborts the destination and warns on later use", async () => {
		const abort = vi.fn<(reason: unknown) => void>();
		const destination = new WritableStream({ abort });
		const logger = new Logger({ destination });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		await logger.destroy();
		logger.info("ignored");

		expect(logger.destroyed).toBe(true);
		expect(abort).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledWith(
			"Logger has been destroyed and cannot be used",
		);
		warn.mockRestore();
	});

	test("a failing destination is reported as an error", async () => {
		const failure = new Error("disk full");
		const destination = new WritableStream({
			write() {
				throw failure;
			},
		});
		const logger = new Logger({ destination });
		const onError = vi.fn<(err: unknown) => void>();
		logger.on("error", ({ data }) => onError(data));

		logger.info("lost");
		await expect.poll(() => onError.mock.calls).toStrictEqual([[failure]]);
	});
});

describe("events", () => {
	test("log fires with each descriptor at or above the level", async () => {
		const { destination } = createCapture();
		const logger = new Logger({ destination, level: Level.Info });
		const onLog = vi.fn<(log: LogDescriptor) => void>();
		logger.on("log", ({ data }) => onLog(data));

		logger.debug("hidden");
		logger.info("shown");
		await logger.end();

		expect(onLog).toHaveBeenCalledOnce();
		expect(onLog).toHaveBeenCalledWith(
			expect.objectContaining({ msg: "shown" }),
		);
	});

	test("off removes a listener", async () => {
		const { destination } = createCapture();
		const logger = new Logger({ destination });
		const onFlush = vi.fn<() => void>();

		logger.on("flush", onFlush);
		await logger.flush();
		logger.off("flush", onFlush);
		await logger.flush();

		expect(onFlush).toHaveBeenCalledOnce();
	});

	test("log methods work detached from the logger", async () => {
		const { logger, logs } = createTestLogger();
		const { trace, debug, info, warn, error, fatal } = logger;

		[trace, debug, info, warn, error, fatal].forEach((method) => method("x"));
		await logger.end();

		expect(logs.map((log) => log.level)).toStrictEqual([
			Level.Trace,
			Level.Debug,
			Level.Info,
			Level.Warn,
			Level.Error,
			Level.Fatal,
		]);
	});
});
