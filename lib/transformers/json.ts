import { serializeError } from "serialize-error";
import type { JsonPrimitive } from "type-fest";
import type { JsonifiableObject, LogDescriptor } from "../logger.ts";
import { safeStringify, withNullProto } from "../utils.ts";

export type JsonLogFormat = JsonifiableObject & {
	level: number;
	time: string;
	msg?: JsonPrimitive;
	ctx?: JsonifiableObject;
};

/**
 * Formats a log as one line of JSON, with `data` at the top level and any
 * error under `error`
 */
export function jsonTransformer(log: LogDescriptor): string {
	const { level, time, ctx, data = {}, msg } = log;
	const { err, ...dataRest } = data;

	const jsonLog: JsonLogFormat = withNullProto({
		level,
		time: time.toISOString(),
		...(msg && { msg }),
		...dataRest,
		...(!!err && {
			error: err instanceof Error ? serializeError(err) : Object(err),
		}),
		...(ctx && { ctx }),
	});

	return `${safeStringify(jsonLog)}\n`;
}
