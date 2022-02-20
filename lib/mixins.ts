import { AsyncLocalStorage } from 'async_hooks';
import { sep } from 'path';
import pino from 'pino';
import { AlsContext, AlsContextOutput, Falsy } from './types.js';

export type MixinFn = NonNullable<pino.LoggerOptions['mixin']>;

export type MixinFnWithData = (
  data: ReturnType<MixinFn>,
) => ReturnType<MixinFn>;

export function callerMixin(): { caller?: string } {
  const stackParts = new Error().stack?.split('\n') || [];

  const nonModuleFramesIndex = stackParts
    .map(
      (s) =>
        s.includes(`node_modules${sep}pino`) ||
        s.includes(`block65${sep}logger`),
    )
    .lastIndexOf(true);

  if (nonModuleFramesIndex === -1) {
    return { caller: '<empty>' };
  }

  const frameCandidate: string | undefined =
    stackParts[nonModuleFramesIndex + 1];

  const caller = frameCandidate
    ? frameCandidate.slice(7).replace(`${process.cwd()}/`, '')
    : frameCandidate;

  return {
    caller,
  };
}

export function composeMixins(
  mixins: (MixinFnWithData | MixinFn | Falsy)[],
): MixinFn {
  return () =>
    mixins.reduce((accum, mixin) => {
      if (!mixin) {
        return accum;
      }
      return {
        ...accum,
        ...mixin(accum),
      };
    }, {});
}

export function createContextMixin(
  als: AsyncLocalStorage<AlsContext>,
): MixinFn {
  return (): Partial<AlsContextOutput> => {
    const store = als.getStore();

    if (!store) {
      return {};
    }

    return {
      _contextId: store.id,
      ...(store?.context && { _context: store?.context }),
    };
  };
}
