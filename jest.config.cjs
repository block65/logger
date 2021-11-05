module.exports = {
  preset: 'ts-jest/presets/default-esm',
  setupFiles: ['./jest-setup.cjs'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  moduleNameMapper: {
    '^(\\..*)\\.jsx?$': '$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  verbose: true,
  extensionsToTreatAsEsm: ['.ts'],
  snapshotSerializers: ['<rootDir>/tools/jest-log-serializer.cjs'],
};
