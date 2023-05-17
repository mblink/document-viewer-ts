module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['./test/jestEnvironment.js', 'jest-canvas-mock'],
};