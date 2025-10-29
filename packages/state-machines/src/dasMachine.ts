import { assign, setup } from 'xstate';

export type DasPosition = 'open' | 'closed';

interface DasContext {
  targetPosition: DasPosition | null;
  intermittentFault: boolean;
  faultProbability: number;
  random: () => number;
}

type DasEvent =
  | { type: 'COMMANDER'; target: DasPosition }
  | { type: 'CONFIRMER_POSITION' }
  | { type: 'SIGNALER_DEFAUT' }
  | { type: 'REARMER' }
  | { type: 'TICK' }
  | { type: 'CONFIGURER_DEFAUT_INTERMITTENT'; probability: number; random?: () => number }
  | { type: 'FORCER_POSITION'; position: DasPosition };

export const dasMachine = setup({
  types: {
    context: {} as DasContext,
    events: {} as DasEvent
  }
}).createMachine({
  id: 'das',
  initial: 'enPosition',
  context: {
    targetPosition: null,
    intermittentFault: false,
    faultProbability: 0,
    random: () => Math.random()
  },
  states: {
    enPosition: {
      on: {
        COMMANDER: {
          target: 'commande',
          actions: assign(({ event }) => ({ targetPosition: event.target }))
        },
        SIGNALER_DEFAUT: 'defaut',
        CONFIGURER_DEFAUT_INTERMITTENT: {
          actions: assign(({ event }) => ({
            intermittentFault: event.probability > 0,
            faultProbability: Math.max(0, Math.min(1, event.probability)),
            random: event.random ?? (() => Math.random())
          }))
        },
        FORCER_POSITION: {
          actions: assign(({ event }) => ({ targetPosition: event.position }))
        }
      }
    },
    commande: {
      entry: assign(({ context }) => ({
        intermittentFault: context.intermittentFault,
        faultProbability: context.faultProbability
      })),
      on: {
        CONFIRMER_POSITION: {
          target: 'enPosition',
          actions: assign(() => ({ targetPosition: null }))
        },
        SIGNALER_DEFAUT: 'defaut',
        TICK: [
          {
            target: 'defaut',
            guard: ({ context }) =>
              context.intermittentFault && context.random() < context.faultProbability
          },
          { actions: () => {} }
        ],
        CONFIGURER_DEFAUT_INTERMITTENT: {
          actions: assign(({ event }) => ({
            intermittentFault: event.probability > 0,
            faultProbability: Math.max(0, Math.min(1, event.probability)),
            random: event.random ?? (() => Math.random())
          }))
        }
      }
    },
    defaut: {
      on: {
        REARMER: {
          target: 'commande',
          actions: assign(({ context }) => ({
            intermittentFault: context.intermittentFault,
            faultProbability: context.faultProbability
          }))
        },
        CONFIGURER_DEFAUT_INTERMITTENT: {
          actions: assign(({ event }) => ({
            intermittentFault: event.probability > 0,
            faultProbability: Math.max(0, Math.min(1, event.probability)),
            random: event.random ?? (() => Math.random())
          }))
        }
      }
    }
  }
});

export type DasState = typeof dasMachine;
export type DasContextType = DasContext;
export type DasEventType = DasEvent;
