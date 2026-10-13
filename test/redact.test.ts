import { describe, expect, test } from "vitest";
import {
	createRedactProcessor,
	Logger,
	type LogDescriptor,
} from "../lib/index.ts";
import { createCapture } from "./helpers.ts";

function createRedactingLogger(paths: string[]) {
	const { chunks, destination } = createCapture<LogDescriptor>();
	const logger = new Logger({
		destination,
		processors: [createRedactProcessor({ paths, censor: "[secret]" })],
	});

	return { logger, logs: chunks };
}

describe("createRedactProcessor", () => {
	test("replaces the values at the given paths", async () => {
		const { logger, logs } = createRedactingLogger([
			"password",
			"headers.authorization",
		]);

		logger.info({
			user: "max",
			password: "trustno1",
			headers: { authorization: "Bearer abc", accept: "text/plain" },
		});
		await logger.end();

		expect(logs[0]?.data).toStrictEqual({
			user: "max",
			password: "[secret]",
			headers: { authorization: "[secret]", accept: "text/plain" },
		});
	});

	test("leaves the caller's object unchanged", async () => {
		const { logger } = createRedactingLogger(["password"]);
		const payload = { password: "trustno1" };

		logger.info(payload);
		await logger.end();

		expect(payload.password).toBe("trustno1");
	});

	test("redacts inside frozen objects", async () => {
		const { logger, logs } = createRedactingLogger(["*.jwt"]);

		logger.error({ token: Object.freeze({ jwt: "eyJ.secret" }) }, "frozen");
		await logger.end();

		expect(logs[0]?.data).toStrictEqual({ token: { jwt: "[secret]" } });
	});

	test("passes a log without data through", async () => {
		const { logger, logs } = createRedactingLogger(["password"]);

		logger.info("password is trustno1");
		await logger.end();

		expect(logs[0]?.msg).toBe("password is trustno1");
		expect(logs[0]).not.toHaveProperty("data");
	});
});
