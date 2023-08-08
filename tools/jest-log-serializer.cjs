/* eslint-disable import/no-extraneous-dependencies */
const fastSafeStringify = require('fast-safe-stringify');
const { format: prettyFormat } = require('pretty-format');
const manifest = require('../package.json');

/**
 *
 * @param {object} err
 * @returns {object}
 */
function errorToObject(err) {
  return JSON.parse(fastSafeStringify(err, Object.getOwnPropertyNames(err)));
}

/**
 *
 * @param {string} str
 * @returns {string}
 */
function redactPaths(str) {
  const repoName = manifest.name.split('/')[1];

  return (
    str
      .replaceAll(new RegExp(`/(.*)/(${repoName})`, 'g'), '~/$2')
      // remove line numbers from native node modules so we can test across
      // versions. This is not future proof, but works right now (node 18 - 20)
      .replaceAll(/node:(.*):(\d+):(\d+)/g, 'node:$1:~:~')
  );
}

/**
 *
 * @param {string} str
 * @returns {string}
 */
function redactDates(str) {
  return str.replaceAll(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g,
    '2009-02-13T23:31:30.000Z',
  );
}

/** @type {import('jest').SnapshotSerializerPlugin} */
module.exports = {
  serialize(val) {
    return redactDates(
      redactPaths(
        prettyFormat(val instanceof Error ? errorToObject(val) : val),
      ),
    );
  },

  test() {
    return true;
  },
};
