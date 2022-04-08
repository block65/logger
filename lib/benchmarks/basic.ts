import { createWriteStream } from 'node:fs';
import { createLogger } from '../index.js';
import { Level } from '../logger.js';

console.time('test');

const logger = createLogger({
  destination: createWriteStream('/dev/null'),
  level: Level.Info,
});

[...Array(1_000_000)].forEach(() => logger.info('hello world'));

await logger.end();
console.timeEnd('test');
