module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.expo/**',
    '!**/coverage/**',
    '!**/jest.config.js',
    '!**/scripts/**',
  ],
  coverageDirectory: './coverage',
  forceExit: true, // Force Jest to exit after all tests complete
  detectOpenHandles: false, // Disable open handles detection
  maxWorkers: 1, // Run tests serially to avoid handle conflicts
};


