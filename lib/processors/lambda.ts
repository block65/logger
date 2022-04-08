import { Processor } from '../logger.js';

export const lambdaProcessor: Processor = (log) => {
  return {
    ...log,
  };
};
