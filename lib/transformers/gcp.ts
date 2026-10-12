import { serializeError } from "serialize-error";
import type { JsonPrimitive } from "type-fest";
import {
	Level,
	type JsonifiableObject,
	type LogDescriptor,
} from "../logger.ts";
import { gcpErrorProcessor } from "../processors/gcp.ts";
import { safeStringify, withNullProto } from "../utils.ts";

type GcpSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

type GcpJsonLogFormat = JsonifiableObject & {
	severity: GcpSeverity;
	time: string;
	message?: JsonPrimitive;
	ctx?: JsonifiableObject;
};

const severities: Record<Level, GcpSeverity> = {
	[Level.Silent]: "DEBUG",
	[Level.Trace]: "DEBUG",
	[Level.Debug]: "DEBUG",
	[Level.Info]: "INFO",
	[Level.Warn]: "WARNING",
	[Level.Error]: "ERROR",
	[Level.Fatal]: "CRITICAL",
};

// https://cloud.google.com/error-reporting/docs/formatting-error-messages
export function gcpTransformer(log: LogDescriptor): string {
	const { level, time, ctx, data = {}, msg } = gcpErrorProcessor(log);
	const { err, ...dataRest } = data;

	const jsonLog: GcpJsonLogFormat = withNullProto({
		severity: severities[level],
		time: time.toISOString(),
		...(msg && { message: msg }),
		...dataRest,
		...(!!err && {
			err: err instanceof Error ? serializeError(err) : Object(err),
		}),
		...(ctx && { ctx }),
	});

	return `${safeStringify(jsonLog)}\n`;
}
