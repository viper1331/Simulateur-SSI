import { createMachine, assign } from 'xstate';

type CmsiContext = {
  t1Remaining: number;
  t2Remaining: number;
};

type CmsiEvent =
  | { type: 'TRIGGER_PREALERTE'; t1: number; t2: number }
  | { type: 'TICK' }
  | { type: 'ACK' }
  | { type: 'RESET' };

export const cmsiMachine = createMachine({
  id: 'cmsi',
  initial: 'idle',
  context: { t1Remaining: 0, t2Remaining: 0 },
  states: {
    idle: {
      on: {
        TRIGGER_PREALERTE: {
          target: 'preAlerte',
          actions: assign(({ event }) => ({
            t1Remaining: event.t1,
            t2Remaining: event.t2
          }))
        }
      }
    },
    preAlerte: {
      on: {
        TICK: {
          target: 'alerte',
          guard: ({ context }) => context.t1Remaining <= 1,
          actions: assign(() => ({
            t1Remaining: 0
          }))
        },
        ACK: 'idle'
      }
    },
    alerte: {
      on: {
        TICK: {
          target: 'ugaActive',
          guard: ({ context }) => context.t2Remaining <= 1,
          actions: assign(() => ({ t2Remaining: 0 }))
        },
        ACK: 'idle'
      }
    },
    ugaActive: {
      on: {
        ACK: 'retourNormal'
      }
    },
    retourNormal: {
      on: {
        RESET: 'idle'
      }
    }
  }
}) as any;

export type CmsiState = typeof cmsiMachine;
