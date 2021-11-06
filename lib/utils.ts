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
