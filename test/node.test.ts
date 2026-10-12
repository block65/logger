import { hostname } from "node:os";
import {
	afterEach,
	assert,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import { Level } from "../lib/index.ts";
import { createLogger } from "../lib/node.ts";
import { createCapture } from "./helpers.ts";

const platformVariables = [
	"AWS_LAMBDA_FUNCTION_VERSION",
	"ECS_AVAILABLE_LOGGING_DRIVERS",
	"K_CONFIGURATION",
	"K_SERVICE",
	"K_REVISION",
	"CI",
	"LOG_LEVEL",
	"NODE_ENV",
];

beforeEach(() => {
	platformVariables.forEach((name) => vi.stubEnv(name, undefined));
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function logOnce() {
	const { chunks, destination } = createCapture<string>();
	const logger = createLogger({ destination });

	logger.info({ status: 200 }, "done");
	await logger.end();

	const [line] = chunks;
	assert(line);

	return { logger, line };
}

describe("createLogger platform detection", () => {
	test("writes JSON lines by default", async () => {
		const { line } = await logOnce();

		expect(JSON.parse(line)).toMatchObject({
			level: Level.Info,
			msg: "done",
			status: 200,
		});
	});

	test("writes readable lines in CI", async () => {
		vi.stubEnv("CI", "true");

		const { line } = await logOnce();

		expect(line).toMatch(/ INFO {3}done \{ status: 200 \}$/u);
	});

	test("writes the CloudWatch format on Lambda", async () => {
		vi.stubEnv("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST");

		const { line } = await logOnce();

		expect(line.split("\t").slice(2, 4)).toStrictEqual(["INFO", "done"]);
	});

	test("writes the CloudWatch format with process details on ECS", async () => {
		vi.stubEnv("ECS_AVAILABLE_LOGGING_DRIVERS", '["awslogs"]');

		const { line } = await logOnce();

		const data = line.trimEnd().split("\t").at(4);
		assert(data);
		expect(JSON.parse(data)).toMatchObject({
			ctx: { pid: process.pid, hostname: hostname() },
		});
	});

	test("writes Cloud Logging JSON on Knative", async () => {
		vi.stubEnv("K_CONFIGURATION", "cfg");
		vi.stubEnv("K_SERVICE", "svc");
		vi.stubEnv("K_REVISION", "rev");

		const { line } = await logOnce();

		expect(JSON.parse(line)).toMatchObject({
			severity: "INFO",
			message: "done",
			ctx: { pid: process.pid, hostname: hostname() },
		});
	});
});

describe("createLogger level", () => {
	test("is info by default", () => {
		expect(
			createLogger({ destination: createCapture().destination }).level,
		).toBe(Level.Info);
	});

	test("comes from LOG_LEVEL", () => {
		vi.stubEnv("LOG_LEVEL", "ERROR");

		expect(
			createLogger({ destination: createCapture().destination }).level,
		).toBe(Level.Error);
	});

	test("is trace in development", () => {
		vi.stubEnv("NODE_ENV", "development");

		expect(
			createLogger({ destination: createCapture().destination }).level,
		).toBe(Level.Trace);
	});

	test("from the options wins over the environment", () => {
		vi.stubEnv("LOG_LEVEL", "error");

		const logger = createLogger({
			destination: createCapture().destination,
			level: Level.Debug,
		});

		expect(logger.level).toBe(Level.Debug);
	});
});

describe("createLogger stdout", () => {
	test("is the destination when none is given", async () => {
		const write = vi.spyOn(process.stdout, "write");
		const logger = createLogger();

		logger.info("to stdout");
		await logger.end();

		expect(write).toHaveBeenCalledWith(
			expect.stringContaining('"msg":"to stdout"'),
			expect.any(Function),
		);
	});

	test("gains no listeners however many loggers write to it", () => {
		const before = process.stdout.listenerCount("drain");

		Array.from({ length: 20 }, () => createLogger());

		expect(process.stdout.listenerCount("drain")).toBe(before);
	});
});
