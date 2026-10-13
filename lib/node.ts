import { hostname } from "node:os";
import type { Except } from "type-fest";
import {
	Logger,
	parseLevel,
	type CreateLoggerOptions,
	type Transformer,
} from "./logger.ts";
import { createCliTransformer } from "./transformers/cli.ts";
import { cloudwatchTransformer } from "./transformers/cloudwatch.ts";
import { gcpTransformer } from "./transformers/gcp.ts";
import { jsonTransformer } from "./transformers/json.ts";

export * from "./index.ts";

export type NodeLoggerOptions = Except<CreateLoggerOptions, "transformer">;

// Writable.toWeb(process.stdout) adds five listeners to stdout per logger
function stdoutDestination() {
	return new WritableStream<unknown>({
		write(chunk) {
			return new Promise<void>((resolve, reject) => {
				process.stdout.write(String(chunk), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
		},
	});
}

type Platform = "lambda" | "ecs" | "knative" | "other";

function detectPlatform(env: NodeJS.ProcessEnv) {
	if (env.AWS_LAMBDA_FUNCTION_VERSION) {
		return "lambda";
	}

	if (env.ECS_AVAILABLE_LOGGING_DRIVERS?.includes("awslogs")) {
		return "ecs";
	}

	if (env.K_CONFIGURATION && env.K_SERVICE && env.K_REVISION) {
		return "knative";
	}

	return "other";
}

function platformTransformer(
	platform: Platform,
	toStdout: boolean,
): Transformer {
	switch (platform) {
		case "lambda":
		case "ecs":
			return cloudwatchTransformer;
		case "knative":
			return gcpTransformer;
		case "other": {
			const isTty = toStdout && process.stdout.isTTY;
			return isTty || process.env.CI
				? createCliTransformer({ color: isTty && process.stdout.hasColors() })
				: jsonTransformer;
		}
	}
}

/**
 * A logger for the platform found in the environment. Lambda and ECS get the
 * CloudWatch format, Knative and Cloud Run get Cloud Logging JSON, a terminal
 * or CI gets readable lines, and other platforms get JSON lines. The level is
 * `options.level`, then `LOG_LEVEL`. Logs go to stdout unless
 * `options.destination` is set
 */
export function createLogger(options: NodeLoggerOptions = {}): Logger {
	const { env } = process;
	const {
		level = parseLevel(env.LOG_LEVEL),
		destination,
		processors,
		context,
	} = options;

	const platform = detectPlatform(env);

	return new Logger({
		level,
		processors,
		transformer: platformTransformer(platform, !destination),
		destination: destination ?? stdoutDestination(),
		context:
			platform === "ecs" || platform === "knative"
				? { pid: process.pid, hostname: hostname(), ...context }
				: context,
	});
}
