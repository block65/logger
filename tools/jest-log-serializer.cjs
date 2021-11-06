const { format: prettyFormat } = require('pretty-format');

module.exports = {
  /**
   *
   * @param val {string}
   * @return {string}
   */
  serialize(val) {
    return prettyFormat(val)
      .replaceAll(process.cwd(), '<rootDir>')
      .replaceAll(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g,
        '2009-02-13T23:31:30.000Z',
      );
  },

  test(val) {
    return val && typeof val === 'string' && val.includes(process.cwd());
  },
};
