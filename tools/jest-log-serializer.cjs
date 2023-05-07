/* eslint-disable import/no-extraneous-dependencies */
const { format: prettyFormat } = require('pretty-format');
const manifest = require('../package.json');

/**
 *
 * @param {object} err
 * @returns {object}
 */
function errorToObject(err) {
  return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
}

/**
 *
 * @param {string} str
 * @returns {string}
 */
function redactPaths(str) {
  return str
    .replaceAll(
      new RegExp(
        `/(.*?)/(${manifest.name.replace('@', '').replace('/', '\\/')})`,
        'g',
      ),
      '~/$2',
    )
    .replaceAll(/\/.*execroot/g, '~')
    .replaceAll(/bin\/(.*\.sh.runfiles|external)/g, '~');
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
