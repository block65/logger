import { Decorator } from '../logger.js';

export const lambdaDecorator: Decorator = (log) => {
  return {
    ...log,
  };
};
