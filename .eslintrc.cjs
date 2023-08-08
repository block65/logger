/**
 * @type {import('eslint').BaseConfig}
 */
module.exports = {
  root: true,
  extends: ['@block65/eslint-config', '@block65/eslint-config/typescript'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
};
