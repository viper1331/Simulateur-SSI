module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },
  moduleNameMapper: {
    '^@ssi/shared-models$': '<rootDir>/../../packages/shared-models/src/index.ts'
  }
};
