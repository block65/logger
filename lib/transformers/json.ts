import { LogDescriptor } from '../logger.js';

export const jsonTransformer = (log: LogDescriptor): string => {
  return JSON.stringify(log);
};
