import { sep } from 'node:path';
import { Processor } from '../logger.js';

export const callerProcessor: Processor = (log) => {
  const stackParts = new Error().stack?.split('\n') || [];

  const nonModuleFramesIndex = stackParts
    .map((s) => !s.startsWith('node:') || s.includes(`block65${sep}logger`))
    .lastIndexOf(true);

  if (nonModuleFramesIndex === -1) {
    return {
      ...log,
      ctx: {
        ...log.ctx,
        caller: '<empty>',
      },
    };
  }

  const frameCandidate: string | undefined =
    stackParts[nonModuleFramesIndex + 1];

  const caller = frameCandidate
    ? frameCandidate.slice(7).replace(`${process.cwd()}/`, '')
    : frameCandidate;

  return {
    ...log,
    ...(caller && {
      ctx: {
        ...log.ctx,
        caller,
      },
    }),
  };
};
