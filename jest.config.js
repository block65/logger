export default {
  setupFiles: ['<rootDir>/jest-setup.cjs'],
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  verbose: process.env.VERBOSE_LOGS, // set by bazel
  testPathIgnorePatterns: [],
  snapshotSerializers: ['<rootDir>/tools/jest-log-serializer.cjs'],
  modulePathIgnorePatterns: ['<rootDir>/tmp/', '<rootDir>/dist/'],
};
