module.exports = {
  preset: 'ts-jest/presets/default-esm',
  setupFiles: ['<rootDir>/jest-setup.cjs'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\..*)\\.jsx?$': '$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  verbose: true,
  extensionsToTreatAsEsm: ['.ts'],
  snapshotSerializers: ['<rootDir>/tools/jest-log-serializer.cjs'],
};
