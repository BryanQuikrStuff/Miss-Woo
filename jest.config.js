module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true
};