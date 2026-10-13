import { Level, type LogDescriptor } from "../logger.ts";

// Error Reporting collects entries that have this @type and a stack_trace
export function gcpErrorProcessor(log: LogDescriptor): LogDescriptor {
	if (log.level < Level.Error || !log.data?.err) {
		return log;
	}

	const { err, ...data } = log.data;
	const { stack, message, ...restErr } =
		err instanceof Error ? err : Object(err);

	return {
		...log,
		data: {
			...data,
			"@type":
				"type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
			stack_trace: stack,
			message,
			...restErr,
		},
	};
}
