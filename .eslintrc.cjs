module.exports = {
  extends: '@block65/eslint-config',
  parserOptions: {
    project: ["./tsconfig.json", "./__tests__/tsconfig.json"]
  }
};
