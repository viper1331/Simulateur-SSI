import { createMachine } from 'xstate';

type AlimEvent =
  | { type: 'COUPURE_SECTEUR' }
  | { type: 'RETOUR_SECTEUR' }
  | { type: 'BATTERIE_FAIBLE' }
  | { type: 'BATTERIE_OK' };

export const alimentationMachine = createMachine({
  id: 'alimentation',
  initial: 'secteur',
  states: {
    secteur: {
      on: {
        COUPURE_SECTEUR: 'batterie'
      }
    },
    batterie: {
      on: {
        BATTERIE_FAIBLE: 'defautBatterie',
        RETOUR_SECTEUR: 'secteur'
      }
    },
    defautBatterie: {
      on: {
        BATTERIE_OK: 'batterie',
        RETOUR_SECTEUR: 'secteur'
      }
    }
  }
});

export type AlimentationState = typeof alimentationMachine;
