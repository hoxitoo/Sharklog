/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  moduleNameMapper: {
    '^@sharklog/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^(\\.{1,2}/.+)\\.js$': '$1',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__tests__/__mocks__/async-storage.ts',
    '^../utils/notifications$':
      '<rootDir>/src/__tests__/__mocks__/notifications.ts',
    '^../../utils/notifications$':
      '<rootDir>/src/__tests__/__mocks__/notifications.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand|@sharklog)/)',
  ],
};
