const { format: prettyFormat } = require('pretty-format');

module.exports = {
  /**
   *
   * @param val {string}
   * @return {string}
   */
  serialize(val) {
    return prettyFormat(val).replaceAll(process.cwd(), '<rootDir>');
  },

  test(val) {
    return val && typeof val === 'string' && val.includes(process.cwd());
  },
};
