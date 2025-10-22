import { scenarioSchema, defaultScenarios, userSchema } from './index';

describe('default scenarios', () => {
  it('are valid according to schema', () => {
    for (const scenario of defaultScenarios) {
      expect(() => scenarioSchema.parse(scenario)).not.toThrow();
    }
  });
});

describe('user schema', () => {
  it('accepts a sanitized user payload', () => {
    expect(() =>
      userSchema.parse({
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'TRAINER',
        createdAt: new Date().toISOString()
      })
    ).not.toThrow();
  });
});
