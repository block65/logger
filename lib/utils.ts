export function isPlainObject<T extends Record<string, unknown>>(
  value: unknown | T,
): value is T {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.getPrototypeOf({});
}

export function stringifyUndefined(details: unknown | object): object {
  if (isPlainObject(details)) {
    return Object.fromEntries(
      Object.entries(details).map(([k, v]) => {
        if (typeof v === 'undefined') {
          return [k, '_(undefined)'];
        }
        return [k, stringifyUndefined(v)];
      }),
    );
  }
  return Object(details);
}

export function withNullProto<T extends Record<string | number, unknown>>(
  obj: T,
): T {
  return Object.assign(Object.create(null), obj);
}

export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.entries(obj).reduce(
    (accum, [k, v]) =>
      typeof v === 'undefined'
        ? accum
        : { ...accum, [k]: isPlainObject(v) ? stripUndefined(v) : v },
    withNullProto({} as T),
  );
}

export function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return '';
  }
}
