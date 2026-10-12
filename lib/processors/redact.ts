import createRedactor, { type RedactOptions } from "@pinojs/redact";
import type { Except } from "type-fest";
import type { Processor } from "../logger.ts";
import { isPlainObject } from "../utils.ts";

export type RedactProcessorOptions = Except<RedactOptions, "serialize">;

/**
 * Replaces the values at `paths` in a log's data, leaving the caller's object
 * untouched
 */
export function createRedactProcessor(
	options: RedactProcessorOptions,
): Processor {
	// with serialize false the result gets an enumerable restore() method, and
	// the identity function returns the redacted copy as it is
	const redact = createRedactor({
		...options,
		serialize: (redacted: unknown) => redacted,
	});

	return function redactProcessor(log) {
		if (!log.data) {
			return log;
		}

		try {
			const redacted = redact(log.data);

			if (!isPlainObject(redacted)) {
				throw new TypeError(
					"Redaction returned something other than an object",
				);
			}

			return {
				...log,
				data: redacted,
			};
		} catch (err) {
			// the keys help debug the crash without revealing the values
			return {
				...log,
				data: {
					LOG_REDACTOR_CRASH:
						err instanceof Error ? String(err.stack) : String(err),
					LOG_REDACTOR_CRASH_KEYS: Object.keys(log.data),
				},
			};
		}
	};
}
