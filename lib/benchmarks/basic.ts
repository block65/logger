import { createWriteStream } from 'node:fs';
import { createLogger } from '../index.js';
import { Level } from '../logger.js';

async function basicIterations(iterations: number) {
  const testName = `Basic: ${iterations} iterations`;

  console.time(testName);

  const logger = createLogger({
    destination: createWriteStream('/dev/null'),
    level: Level.Trace,
  });

  [...Array(iterations)].forEach(() => logger.info('hello world'));

  await logger.end();

  console.timeEnd(testName);
}

await basicIterations(100);
await basicIterations(1_000);
await basicIterations(10_000);
await basicIterations(100_000);
