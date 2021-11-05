import { Namespace } from 'cls-hooked';
import { sep } from 'path';
import pino from 'pino';
import { ClsContext, Falsy, NamespaceContext } from './types.js';

export type MixinFnWithData = (
  data: ReturnType<pino.MixinFn>,
) => ReturnType<pino.MixinFn>;

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
    return {};
  }

  const frameCandidate: string | undefined =
    stackParts[nonModuleFramesIndex + 1];

  const caller = frameCandidate
    ? frameCandidate.substr(7).replace(`${process.cwd()}/`, '')
    : frameCandidate;

  return {
    caller,
  };
}

export function composeMixins(
  mixins: (MixinFnWithData | pino.MixinFn | Falsy)[],
): pino.MixinFn {
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

export function createContextMixin(cls: Namespace): pino.MixinFn {
  return (): Partial<ClsContext> => {
    const { active }: { active: NamespaceContext | null } = cls || {};

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { id, _ns_name, ...clsContext } = active || {};
    return clsContext;
  };
}
