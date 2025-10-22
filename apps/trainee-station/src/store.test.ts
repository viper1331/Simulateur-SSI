import type { Scenario } from '@ssi/shared-models';
import { mergeScenarioDefinition } from './store';

describe('mergeScenarioDefinition', () => {
  const createScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
    id: overrides.id ?? 'scenario-1',
    name: overrides.name ?? 'Scenario 1',
    description: overrides.description ?? 'Description',
    t1: overrides.t1 ?? 10,
    t2: overrides.t2 ?? 5,
    zd:
      overrides.zd ?? [
        { id: 'zd-1', name: 'Zone 1', description: 'Zone', linkedZoneIds: ['zf-1'] }
      ],
    zf:
      overrides.zf ?? [
        { id: 'zf-1', name: 'Zone Sécu', dasIds: ['das-1'], ugaChannel: 'uga' }
      ],
    das:
      overrides.das ?? [
        { id: 'das-1', name: 'DAS 1', type: 'compartimentage', zoneId: 'zf-1', status: 'en_position' }
      ],
    peripherals: overrides.peripherals ?? [
      { id: 'periph-1', name: 'DM', type: 'dm', zoneId: 'zd-1', description: 'Déclencheur' }
    ],
    events:
      overrides.events ?? [
        { id: 'event-1', scenarioId: overrides.id ?? 'scenario-1', timestamp: 0, type: 'ALARME_DM', payload: {} }
      ]
  });

  it('adds the scenario when not present', () => {
    const scenarios: Scenario[] = [];
    const next = createScenario();

    const result = mergeScenarioDefinition(scenarios, next);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(next);
  });

  it('replaces the scenario when ids match', () => {
    const original = createScenario({ t1: 15 });
    const updated = createScenario({ t1: 30 });

    const result = mergeScenarioDefinition([original], updated);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(updated);
  });

  it('preserves other scenarios in the list', () => {
    const other = createScenario({ id: 'scenario-2', name: 'Scenario 2' });
    const original = createScenario({ t2: 20 });
    const updated = createScenario({ t2: 40 });

    const result = mergeScenarioDefinition([other, original], updated);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(other);
    expect(result[1]).toBe(updated);
  });
});
