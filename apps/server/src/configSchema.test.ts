import { describe, expect, it } from '@jest/globals';
import { processAckSchema, siteConfigSchema } from './configSchema';

describe('siteConfigSchema', () => {
  it('accepts valid payloads', () => {
    const payload = {
      evacOnDAI: false,
      evacOnDMDelayMs: 7500,
      processAckRequired: true
    };
    expect(siteConfigSchema.parse(payload)).toEqual(payload);
  });

  it('rejects negative timers', () => {
    expect(() =>
      siteConfigSchema.parse({ evacOnDAI: false, evacOnDMDelayMs: -1, processAckRequired: true })
    ).toThrow();
  });

  it('rejects values beyond the maximum range', () => {
    expect(() =>
      siteConfigSchema.parse({ evacOnDAI: true, evacOnDMDelayMs: 9999999, processAckRequired: false })
    ).toThrow();
  });
});

describe('processAckSchema', () => {
  it('requires a non-empty operator name', () => {
    expect(() => processAckSchema.parse({ ackedBy: '' })).toThrow();
    expect(processAckSchema.parse({ ackedBy: 'Formateur' })).toEqual({ ackedBy: 'Formateur' });
  });
});
