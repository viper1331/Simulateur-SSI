import { createMachine } from 'xstate';

type DasEvent =
  | { type: 'COMMANDER' }
  | { type: 'CONFIRMER_POSITION' }
  | { type: 'SIGNALER_DEFAUT' }
  | { type: 'REARMER' };

export const dasMachine = createMachine({
  id: 'das',
  initial: 'enPosition',
  states: {
    enPosition: {
      on: {
        COMMANDER: 'commande'
      }
    },
    commande: {
      on: {
        CONFIRMER_POSITION: 'enPosition',
        SIGNALER_DEFAUT: 'defaut'
      }
    },
    defaut: {
      on: {
        REARMER: 'enPosition'
      }
    }
  }
});

export type DasState = typeof dasMachine;
