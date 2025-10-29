import { createActor } from 'xstate';
import { cmsiMachine } from './cmsiMachine';

describe('cmsiMachine', () => {
  it('progresses from pre-alerte to UGA when timers elapse', () => {
    const actor = createActor(cmsiMachine);
    actor.start();
    actor.send({ type: 'TRIGGER_PREALERTE', t1: 2, t2: 2, message: 'ZD1' });
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('preAlerte');
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('alerte');
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('alerte');
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('ugaActive');
  });

  it('requires ACK and devices ready before reset', () => {
    const actor = createActor(cmsiMachine);
    actor.start();
    actor.send({ type: 'TRIGGER_PREALERTE', t1: 1, t2: 1 });
    actor.send({ type: 'TICK' });
    actor.send({ type: 'TICK' });
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('ugaActive');
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('ugaActive');
    actor.send({ type: 'ACK' });
    actor.send({ type: 'STOP_UGA' });
    expect(actor.getSnapshot().value).toBe('attenteReset');
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('attenteReset');
    actor.send({ type: 'DM_STATUS', rearmed: true });
    actor.send({ type: 'DAS_POSITION', ready: true });
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('supports zone masking tracking', () => {
    const actor = createActor(cmsiMachine);
    actor.start();
    actor.send({ type: 'MASK_ZONE', zone: 'ZD1', active: true });
    actor.send({ type: 'MASK_ZONE', zone: 'ZD2', active: true });
    actor.send({ type: 'MASK_ZONE', zone: 'ZD1', active: false });
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.maskedZones.has('ZD1')).toBe(false);
    expect(snapshot.context.maskedZones.has('ZD2')).toBe(true);
  });
});
