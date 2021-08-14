module.exports = {
  preset: 'ts-jest',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  setupFiles: ['./jest-setup.cjs'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\..*)\\.jsx?$': '$1',
  },
};
