module.exports = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@ssi/shared-models$': '<rootDir>/../../packages/shared-models/src/index.ts',
    '^@ssi/state-machines$': '<rootDir>/../../packages/state-machines/src/index.ts',
    '^@ssi/ui-kit$': '<rootDir>/../../packages/ui-kit/src/index.ts'
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};
