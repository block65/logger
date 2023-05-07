export default {
  setupFiles: ['<rootDir>/jest-setup.cjs'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  verbose: process.env.VERBOSE_LOGS, // set by bazel
  testPathIgnorePatterns: [],
  snapshotSerializers: ['<rootDir>/tools/jest-log-serializer.cjs'],
  modulePathIgnorePatterns: ['<rootDir>/tmp/', '<rootDir>/dist/'],
  // reporters: ['default', '<rootDir>/tools/jest-reporter.cjs'],
  moduleNameMapper: {
    '^(\\..*)\\.jsx?$': '$1', // support for ts imports with .js extensions
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
