import { assert, describe, expect, test } from "vitest";
import {
	cliTransformer,
	createCliTransformer,
	jsonTransformer,
	Level,
	Logger,
	type LogDescriptor,
} from "../lib/index.ts";
import { cloudwatchTransformer } from "../lib/transformers/cloudwatch.ts";
import { gcpTransformer } from "../lib/transformers/gcp.ts";
import { createCapture } from "./helpers.ts";

const time = new Date("2026-01-02T03:04:05.678Z");

const infoLog: LogDescriptor = {
	time,
	level: Level.Info,
	msg: "request done",
	data: { status: 200, path: "/health" },
	ctx: { service: "api" },
};

const failure = Object.assign(new Error("boom"), {
	stack: "Error: boom\n    at here",
});

const errorLog: LogDescriptor = {
	time,
	level: Level.Error,
	msg: "request failed",
	data: { err: failure, path: "/fail" },
	err: failure,
};

// oxlint-disable-next-line eslint/no-control-regex -- ANSI codes start with ESC
const ansi = /\u001B\[\d+m/u;

describe("jsonTransformer", () => {
	test("writes one JSON line with data at the top level", () => {
		const line = jsonTransformer(infoLog);

		expect(line.endsWith("\n")).toBe(true);
		expect(line.trimEnd()).not.toContain("\n");
		expect(JSON.parse(line)).toStrictEqual({
			level: Level.Info,
			time: time.toISOString(),
			msg: "request done",
			status: 200,
			path: "/health",
			ctx: { service: "api" },
		});
	});

	test("serializes an error under the error key", () => {
		expect(JSON.parse(jsonTransformer(errorLog))).toMatchObject({
			level: Level.Error,
			path: "/fail",
			error: { name: "Error", message: "boom", stack: failure.stack },
		});
	});
});

describe("cliTransformer", () => {
	test("writes the time, level, message and data on one line", () => {
		const line = cliTransformer(infoLog);

		expect(line).not.toMatch(ansi);
		expect(line).toMatch(
			/^2026-01-02T03:04:05\.678Z INFO {3}request done \{.*\}$/u,
		);
		expect(line).toContain("status: 200");
		expect(line).toContain("path: '/health'");
		expect(line).toContain("ctx: { service: 'api' }");
	});

	test("leaves out the time when timestamps are off", () => {
		expect(cliTransformer(infoLog, { timestamps: false })).toMatch(
			/^INFO {3}request done/u,
		);
	});

	test("shows ctx.name in brackets before the message", () => {
		const line = cliTransformer(
			{ time, level: Level.Warn, msg: "careful", ctx: { name: "db" } },
			{ timestamps: false },
		);

		expect(line).toBe("WARN   (db) careful");
	});

	test("colours the output only when asked", () => {
		const coloured = cliTransformer(errorLog, { color: true });

		expect(coloured).toMatch(ansi);
		expect(coloured.replaceAll(new RegExp(ansi, "gu"), "")).toBe(
			cliTransformer(errorLog),
		);
	});

	test("aligns every level label to the same width", () => {
		const levels = [
			Level.Trace,
			Level.Debug,
			Level.Info,
			Level.Warn,
			Level.Error,
			Level.Fatal,
		];

		const messageColumns = levels.map((level) =>
			cliTransformer({ time, level, msg: "x" }, { timestamps: false }).indexOf(
				"x",
			),
		);

		expect(new Set(messageColumns).size).toBe(1);
	});

	test("createCliTransformer applies its options to every log", async () => {
		const { chunks, destination } = createCapture<string>();
		const logger = new Logger({
			destination,
			transformer: createCliTransformer({ color: true, timestamps: false }),
		});

		logger.info("hi");
		await logger.end();

		const [line] = chunks;
		assert(line);
		expect(line).toMatch(ansi);
		expect(line.replaceAll(new RegExp(ansi, "gu"), "")).toBe("INFO   hi");
	});
});

describe("cloudwatchTransformer", () => {
	test("writes tab separated time, request id, level, message and data", () => {
		const line = cloudwatchTransformer({
			...infoLog,
			ctx: { id: "req-1", service: "api" },
		});

		expect(line.endsWith("\n")).toBe(true);

		const [lineTime, id, level, msg, data] = line.trimEnd().split("\t");
		expect([lineTime, id, level, msg]).toStrictEqual([
			time.toISOString(),
			"req-1",
			"INFO",
			"request done",
		]);
		assert(data);
		expect(JSON.parse(data)).toStrictEqual({
			level: Level.Info,
			status: 200,
			path: "/health",
			ctx: { service: "api" },
		});
	});

	test("keeps a multi-line message on one line", () => {
		const line = cloudwatchTransformer({
			time,
			level: Level.Fatal,
			msg: "a\nb\nc\n",
		});

		expect(line.split("\t")[3]).toBe("a\rb\rc");
		expect(line.split("\t")[2]).toBe("FATAL");
	});

	test("shows undefined data values instead of dropping them", () => {
		const line = cloudwatchTransformer({
			time,
			level: Level.Info,
			data: { missing: undefined },
		});

		expect(line).toContain('"missing":"_(undefined)"');
	});
});

describe("gcpTransformer", () => {
	test("maps the level to a Cloud Logging severity", () => {
		const levels = [
			Level.Trace,
			Level.Debug,
			Level.Info,
			Level.Warn,
			Level.Error,
			Level.Fatal,
		];

		const parsed = levels.map((level) =>
			JSON.parse(gcpTransformer({ time, level })),
		);

		expect(parsed).toMatchObject(
			["DEBUG", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map(
				(severity) => ({ severity }),
			),
		);
	});

	test("formats an error for Error Reporting", () => {
		expect(JSON.parse(gcpTransformer(errorLog))).toMatchObject({
			severity: "ERROR",
			time: time.toISOString(),
			message: "boom",
			path: "/fail",
			stack_trace: failure.stack,
			"@type":
				"type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
		});
	});

	test("leaves an error below error level as data", () => {
		const parsed: unknown = JSON.parse(
			gcpTransformer({ ...errorLog, level: Level.Warn }),
		);

		expect(parsed).toMatchObject({
			severity: "WARNING",
			message: "request failed",
			err: { message: "boom" },
		});
		expect(parsed).not.toHaveProperty("stack_trace");
	});
});
