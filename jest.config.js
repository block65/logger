export default {
  setupFiles: ['<rootDir>/jest-setup.cjs'],
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  verbose: process.env.VERBOSE_LOGS, // set by bazel
  testPathIgnorePatterns: [],
  snapshotSerializers: ['<rootDir>/tools/jest-log-serializer.cjs'],
  modulePathIgnorePatterns: ['<rootDir>/tmp/', '<rootDir>/dist/'],
  moduleNameMapper: {
    '@block65/logger/file-transport': '<rootDir>/lib/file-transport.js',
    '@block65/logger/sentry-transport': '<rootDir>/lib/sentry-transport.js',
    '@block65/logger/pretty-transport': '<rootDir>/lib/pretty-transport.js',
    '@block65/logger': '<rootDir>',
  },
};
