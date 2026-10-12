import { describe, expect, test, vi } from "vitest";
import { Level, Logger, type LogDescriptor } from "../lib/index.ts";
import { createCapture, createTestLogger } from "./helpers.ts";

describe("child loggers", () => {
	test("add their data to each log", async () => {
		const { logger, logs } = createTestLogger();
		const child = logger.child({ requestId: "r1" });

		child.info({ step: 1 }, "working");
		await logger.end();

		expect(logs).toMatchObject([
			{ msg: "working", data: { step: 1, requestId: "r1" } },
		]);
	});

	test("write through the parent's processors and transformer", async () => {
		const { chunks, destination } = createCapture<string>();
		const parent = new Logger({
			destination,
			processors: [(log) => ({ ...log, msg: `parent saw ${String(log.msg)}` })],
			transformer: (log) => String(log.msg),
		});
		const child = parent.child(
			{},
			{
				processors: [
					(log) => ({ ...log, msg: `child saw ${String(log.msg)}` }),
				],
			},
		);

		child.info("hello");
		await parent.end();

		expect(chunks).toStrictEqual(["parent saw child saw hello"]);
	});

	test("take the parent's level unless given their own", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const parent = new Logger({ destination, level: Level.Warn });
		const inheriting = parent.child({ who: "inheriting" });
		const verbose = parent.child({ who: "verbose" }, { level: Level.Trace });

		inheriting.info("dropped");
		inheriting.error("kept");
		verbose.debug("kept");
		parent.info("dropped");
		await parent.end();

		expect(chunks.map((log) => [log.data?.who, log.msg])).toStrictEqual([
			["inheriting", "kept"],
			["verbose", "kept"],
		]);
	});

	test("replace the parent's context with their own", async () => {
		const { chunks, destination } = createCapture<LogDescriptor>();
		const parent = new Logger({ destination, context: { parent: true } });
		const child = parent.child({}, { context: { child: true } });

		parent.info("from parent");
		await parent.flush();
		child.info("from child");
		await parent.end();

		expect(chunks.map((log) => log.ctx)).toStrictEqual([
			{ parent: true },
			{ child: true },
		]);
	});

	test("are flushed and ended with the parent", async () => {
		const { logger, logs, errors } = createTestLogger();
		const onEnd = vi.fn<() => void>();
		const count = 500;

		Array.from({ length: count }, (_, childIndex) => childIndex).forEach(
			(childIndex) => {
				const child = logger.child({ childIndex });
				child.on("end", onEnd);
				child.info("hello");
			},
		);

		await logger.end();

		expect(logs).toHaveLength(count);
		expect(onEnd).toHaveBeenCalledTimes(count);
		expect(errors).toStrictEqual([]);
	});

	test("keep the parent's error key handling", async () => {
		const { logger, logs } = createTestLogger();
		const err = new Error("child failure");

		logger
			.child({ requestId: "r2" })
			.fatal({ err, extra: 1 }, "Time is an %s", "illusion");
		await logger.end();

		expect(logs).toMatchObject([
			{
				msg: "Time is an illusion",
				err,
				data: { requestId: "r2", extra: 1, err: { message: "child failure" } },
			},
		]);
	});
});
