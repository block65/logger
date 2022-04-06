import { sep } from 'node:path';
import { Decorator } from '../logger.js';

export const callerDecorator: Decorator = (log) => {
  const stackParts = new Error().stack?.split('\n') || [];

  const nonModuleFramesIndex = stackParts
    .map((s) => s.includes(`block65${sep}logger`))
    .lastIndexOf(true);

  if (nonModuleFramesIndex === -1) {
    return {
      ...log,
      data: {
        ...log.data,
        caller: '<empty',
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
    data: {
      ...log.data,
      ...(caller && { caller }),
    },
  };
};
