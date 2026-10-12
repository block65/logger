import { configure } from "safe-stable-stringify";

const stringify = configure({ deterministic: false });

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	if (Object.prototype.toString.call(value) !== "[object Object]") {
		return false;
	}

	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}

// JSON drops undefined values, and this keeps them visible as a marker string
export function stringifyUndefined(details: unknown): Record<string, unknown> {
	return isPlainObject(details)
		? Object.fromEntries(
				Object.entries(details).map(([k, v]) => [k, markUndefined(v)]),
			)
		: {};
}

function markUndefined(value: unknown) {
	if (value === undefined) {
		return "_(undefined)";
	}

	return isPlainObject(value) ? stringifyUndefined(value) : value;
}

export function withNullProto<T extends Record<string | number, unknown>>(
	obj: T,
): T {
	return Object.assign(Object.create(null), obj);
}

export function isEmptyObject(obj: Record<string, unknown>): boolean {
	return Object.keys(obj).length === 0;
}

// a toJSON() that throws gives an empty string, so the log is still written
export function safeStringify(value: unknown): string {
	try {
		return String(stringify(value));
	} catch {
		return "";
	}
}

export function toText(value: unknown): string {
	if (value === undefined) {
		return "";
	}
	return typeof value === "string" ? value : safeStringify(value);
}
