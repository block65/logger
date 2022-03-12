import { once } from 'events';
import { createWriteStream } from 'node:fs';
import build from 'pino-abstract-transport';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';

export default (opts: SonicBoomOpts) => {
  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom(opts);

  // await once(destination, 'ready');

  return build(
    async (source) => {
      // eslint-disable-next-line no-restricted-syntax
      for await (const obj of source) {
        const toDrain = !destination.write(obj);
        // This block will handle backpressure
        if (toDrain) {
          await once(destination, 'drain');
        }
      }
    },
    {
      async close(err) {
        if (err) {
          console.warn(err);
        }
        destination.end();
        await once(destination, 'close');
      },
    },
  );
};
