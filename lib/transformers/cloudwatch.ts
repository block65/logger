import { Level, type LogDescriptor } from "../logger.ts";
import {
	isEmptyObject,
	safeStringify,
	stringifyUndefined,
	toText,
} from "../utils.ts";

// the level names that the AWS Lambda Node.js runtime writes
type AwsLevelName = "FATAL" | "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

const awsLevelNames: Record<Level, AwsLevelName> = {
	[Level.Silent]: "TRACE",
	[Level.Trace]: "TRACE",
	[Level.Debug]: "DEBUG",
	[Level.Info]: "INFO",
	[Level.Warn]: "WARN",
	[Level.Error]: "ERROR",
	[Level.Fatal]: "FATAL",
};

/**
 * Formats a log like the AWS Lambda runtime's console output, which CloudWatch
 * parses for the level and request id
 */
export function cloudwatchTransformer(log: LogDescriptor): string {
	const { level, msg, ctx = {}, time, data } = log;
	const { id: contextId, ...ctxRest } = ctx;

	const dataStr = safeStringify({
		level,
		...stringifyUndefined(data),
		...(!isEmptyObject(ctxRest) && { ctx: ctxRest }),
	});

	const line = [
		time.toISOString(),
		toText(contextId),
		awsLevelNames[level],
		// the Lambda runtime turns LF into CR so a message stays on one line
		toText(msg).trim().replaceAll("\n", "\r"),
		dataStr,
	].join("\t");

	return `${line}\n`;
}
