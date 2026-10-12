import { Level, Logger, type LogDescriptor } from "../lib/index.ts";

export function createCapture<T>() {
	const chunks: T[] = [];
	const destination = new WritableStream<T>({
		write(chunk) {
			chunks.push(chunk);
		},
	});

	return { chunks, destination };
}

/**
 * A trace level logger with no transformer, so the destination receives each
 * LogDescriptor, plus every error the logger reports
 */
export function createTestLogger() {
	const { chunks, destination } = createCapture<LogDescriptor>();
	const logger = new Logger({ destination, level: Level.Trace });
	const errors: unknown[] = [];

	logger.on("error", ({ data }) => {
		errors.push(data);
	});

	return { logger, logs: chunks, errors };
}
