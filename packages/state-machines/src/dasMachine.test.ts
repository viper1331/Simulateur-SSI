import { createActor } from 'xstate';
import { dasMachine } from './dasMachine';

describe('dasMachine', () => {
  it('can enter fault due to intermittent probability', () => {
    const actor = createActor(dasMachine);
    actor.start();
    actor.send({ type: 'COMMANDER', target: 'open' });
    actor.send({ type: 'CONFIGURER_DEFAUT_INTERMITTENT', probability: 1, random: () => 0 });
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().value).toBe('defaut');
  });

  it('requires rearm to leave fault', () => {
    const actor = createActor(dasMachine);
    actor.start();
    actor.send({ type: 'SIGNALER_DEFAUT' });
    expect(actor.getSnapshot().value).toBe('defaut');
    actor.send({ type: 'REARMER' });
    expect(actor.getSnapshot().value).toBe('commande');
    actor.send({ type: 'CONFIRMER_POSITION' });
    expect(actor.getSnapshot().value).toBe('enPosition');
  });
});
