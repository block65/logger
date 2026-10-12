import manifest from './package.json' with { type: 'json' };

function redactPaths(str: string): string {
  const repoName = manifest.name.split('/')[1];

  return (
    str
      .replaceAll(new RegExp(`/(.*)/(${repoName})`, 'g'), '~/$2')
      .replaceAll(/file:\/\/\/(.*?)\/(node_modules\/.*?)/g, 'file://~/$2')
      // dep stack frames don't contain the repo name, so collapse any
      // absolute path up to node_modules to avoid leaking local paths
      .replaceAll(/(?:\/[^/\s:()]+)+\/(node_modules\/)/g, '~/$1')
      // remove line numbers from native node modules so we can test across
      // versions. This is not future proof, but works right now (node 18 - 20)
      .replaceAll(/node:(.*):(\d+):(\d+)/g, 'node:$1:~:~')
  );
}

export default {
  serialize(val: string): string {
    return redactPaths(val);
  },

  test(val: unknown): val is string {
    return typeof val === 'string';
  },
};