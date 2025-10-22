import { defaultScenarios } from '@ssi/shared-models';

describe('bootstrap', () => {
  it('provides default scenarios', () => {
    expect(defaultScenarios).not.toHaveLength(0);
  });
});
