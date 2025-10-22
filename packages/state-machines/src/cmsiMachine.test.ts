import { createActor } from 'xstate';
import { cmsiMachine } from './cmsiMachine';

describe('cmsiMachine', () => {
  it('progresses from idle to ugaActive', () => {
    const actor = createActor(cmsiMachine);
    actor.start();
    actor.send({ type: 'TRIGGER_PREALERTE', t1: 1, t2: 1 });
    actor.send({ type: 'TICK' });
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('ugaActive');
  });
});
