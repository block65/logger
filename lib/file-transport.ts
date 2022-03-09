import { once } from 'events';
import build from 'pino-abstract-transport';
import SonicBoom from 'sonic-boom';

export default async (opts: { destination: string | number }) => {
  // SonicBoom is necessary to avoid loops with the main thread.
  // It is the same of pino.destination().
  const destination = new SonicBoom({
    dest: opts.destination || 1,
    sync: false,
  });

  await once(destination, 'ready');

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
        console.warn(err);
        destination.end();
        await once(destination, 'close');
      },
    },
  );
};
