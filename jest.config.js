module.exports = {
  preset: 'ts-jest',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  setupFiles: ['./jest-setup.js'],
  testEnvironment: './node.js',
};
