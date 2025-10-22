import { scenarioSchema, defaultScenarios } from './index';

describe('default scenarios', () => {
  it('are valid according to schema', () => {
    for (const scenario of defaultScenarios) {
      expect(() => scenarioSchema.parse(scenario)).not.toThrow();
    }
  });
});
