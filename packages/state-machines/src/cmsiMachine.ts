import { assign, setup } from 'xstate';

type CmsiKeyMode = 'USER' | 'AUTHOR';

type CmsiContext = {
  t1Remaining: number;
  t2Remaining: number;
  lcdLines: string[];
  buzzer: boolean;
  keyMode: CmsiKeyMode;
  maskedZones: Set<string>;
  acked: boolean;
  ugaActive: boolean;
  dmRearmed: boolean;
  dasReady: boolean;
};

type CmsiEvent =
  | { type: 'TRIGGER_PREALERTE'; t1: number; t2: number; message?: string }
  | { type: 'TICK'; delta?: number }
  | { type: 'ACK' }
  | { type: 'RESET' }
  | { type: 'STOP_UGA' }
  | { type: 'FORCE_UGA' }
  | { type: 'DM_STATUS'; rearmed: boolean }
  | { type: 'DAS_POSITION'; ready: boolean }
  | { type: 'KEY_TURN'; mode: CmsiKeyMode }
  | { type: 'SET_MODE'; mode: CmsiKeyMode }
  | { type: 'LCD_PUSH'; lines: string[] }
  | { type: 'BUZZER_TOGGLE'; active?: boolean }
  | { type: 'SET_BUZZER'; active: boolean }
  | { type: 'SILENCE_BUZZER' }
  | { type: 'MASK_ZONE'; zone: string; active: boolean };

const sanitizeLines = (lines: string[], fallback: string[]): string[] => {
  const targetLength = Math.max(2, Math.min(lines.length || fallback.length || 2, 4));
  const base = lines.length ? lines : fallback;
  return Array.from({ length: targetLength }).map((_, index) => {
    const line = base[index] ?? '';
    return line.slice(0, 40);
  });
};

export const cmsiMachine = setup({
  types: {
    context: {} as CmsiContext,
    events: {} as CmsiEvent
  },
  actions: {
    updateMaskedZones: assign(({ context, event }) => {
      if (event.type !== 'MASK_ZONE') {
        return {};
      }
      const zones = new Set(context.maskedZones);
      if (event.active) {
        zones.add(event.zone);
      } else {
        zones.delete(event.zone);
      }
      return { maskedZones: zones };
    }),
    pushLcd: assign(({ context, event }) => {
      if (event.type !== 'LCD_PUSH') {
        return {};
      }
      return { lcdLines: sanitizeLines(event.lines, context.lcdLines) };
    }),
    toggleBuzzer: assign(({ context, event }) => {
      if (event.type === 'BUZZER_TOGGLE') {
        return { buzzer: event.active ?? !context.buzzer };
      }
      if (event.type === 'SILENCE_BUZZER') {
        return { buzzer: false };
      }
      if (event.type === 'SET_BUZZER') {
        return { buzzer: event.active };
      }
      return {};
    }),
    setKeyMode: assign(({ event }) => {
      if (event.type !== 'KEY_TURN' && event.type !== 'SET_MODE') {
        return {};
      }
      return { keyMode: event.mode };
    }),
    registerDeviceStatus: assign(({ event }) => {
      if (event.type === 'DM_STATUS') {
        return { dmRearmed: event.rearmed };
      }
      if (event.type === 'DAS_POSITION') {
        return { dasReady: event.ready };
      }
      return {};
    })
  }
}).createMachine(
  {
    id: 'cmsi',
    initial: 'idle',
    context: {
      t1Remaining: 0,
      t2Remaining: 0,
      lcdLines: ['SYSTEME PRET', '', '', ''],
      buzzer: false,
      keyMode: 'USER',
      maskedZones: new Set(),
      acked: false,
      ugaActive: false,
      dmRearmed: true,
      dasReady: true
    },
    on: {
      KEY_TURN: { actions: 'setKeyMode' },
      SET_MODE: { actions: 'setKeyMode' },
      LCD_PUSH: { actions: 'pushLcd' },
      BUZZER_TOGGLE: { actions: 'toggleBuzzer' },
      SET_BUZZER: { actions: 'toggleBuzzer' },
      SILENCE_BUZZER: { actions: 'toggleBuzzer' },
      MASK_ZONE: { actions: 'updateMaskedZones' },
      DM_STATUS: { actions: 'registerDeviceStatus' },
      DAS_POSITION: { actions: 'registerDeviceStatus' }
    },
    states: {
      idle: {
        entry: assign(() => ({
          lcdLines: ['SYSTEME PRET', '', '', ''],
          acked: false,
          ugaActive: false,
          t1Remaining: 0,
          t2Remaining: 0
        })),
        on: {
          TRIGGER_PREALERTE: {
            target: 'preAlerte',
            actions: assign(({ event }) => ({
              t1Remaining: event.t1,
              t2Remaining: event.t2,
              buzzer: true,
              acked: false,
              ugaActive: false,
              dmRearmed: false,
              lcdLines: sanitizeLines(
                [
                  'ALARME FEU',
                  event.message ?? 'Pre-alerte',
                  `T1=${event.t1}s`,
                  `T2=${event.t2}s`
                ],
                ['ALARME FEU']
              )
            }))
          },
          FORCE_UGA: {
            target: 'ugaActive',
            actions: assign(({ event, context }) => ({
              ugaActive: true,
              buzzer: true,
              lcdLines: sanitizeLines([
                'EVACUATION GENERALE',
                event.type === 'FORCE_UGA' ? 'Commande manuelle' : '',
                '',
                ''
              ], context.lcdLines)
            }))
          }
        }
      },
      preAlerte: {
        on: {
          TICK: [
            {
              target: 'alerte',
              guard: ({ context, event }) => {
                const delta = event.delta ?? 1;
                return context.t1Remaining - delta <= 0;
              },
              actions: assign(({ context, event }) => {
                const delta = event.delta ?? 1;
                const remaining = Math.max(0, context.t1Remaining - delta);
                return {
                  t1Remaining: remaining,
                  lcdLines: sanitizeLines([
                    'PRE-ALERTE',
                    `T1 restant: ${remaining}s`,
                    context.lcdLines[2] ?? '',
                    context.lcdLines[3] ?? ''
                  ], context.lcdLines)
                };
              })
            },
            {
              actions: assign(({ context, event }) => {
                const delta = event.delta ?? 1;
                const remaining = Math.max(0, context.t1Remaining - delta);
                return {
                  t1Remaining: remaining,
                  lcdLines: sanitizeLines([
                    'PRE-ALERTE',
                    `T1 restant: ${remaining}s`,
                    context.lcdLines[2] ?? '',
                    context.lcdLines[3] ?? ''
                  ], context.lcdLines)
                };
              })
            }
          ],
          ACK: {
            target: 'idle',
            actions: assign(({ context }) => ({
              acked: true,
              buzzer: false,
              lcdLines: sanitizeLines(['ACK RECU', 'Retour au repos'], context.lcdLines)
            }))
          }
        }
      },
      alerte: {
        entry: assign(({ context }) => ({
          lcdLines: sanitizeLines([
            'ALERTE FEU',
            `T2 restant: ${context.t2Remaining}s`,
            context.lcdLines[2] ?? '',
            context.lcdLines[3] ?? ''
          ], context.lcdLines)
        })),
        on: {
          TICK: [
            {
              target: 'ugaActive',
              guard: ({ context, event }) => {
                const delta = event.delta ?? 1;
                return context.t2Remaining - delta <= 0;
              },
              actions: assign(({ context, event }) => {
                const delta = event.delta ?? 1;
                const remaining = Math.max(0, context.t2Remaining - delta);
                return {
                  t2Remaining: remaining,
                  ugaActive: true,
                  buzzer: true,
                  lcdLines: sanitizeLines([
                    'EVACUATION',
                    'UGA active',
                    context.lcdLines[2] ?? '',
                    context.lcdLines[3] ?? ''
                  ], context.lcdLines)
                };
              })
            },
            {
              actions: assign(({ context, event }) => {
                const delta = event.delta ?? 1;
                const remaining = Math.max(0, context.t2Remaining - delta);
                return {
                  t2Remaining: remaining,
                  lcdLines: sanitizeLines([
                    'ALERTE FEU',
                    `T2 restant: ${remaining}s`,
                    context.lcdLines[2] ?? '',
                    context.lcdLines[3] ?? ''
                  ], context.lcdLines)
                };
              })
            }
          ],
          ACK: {
            actions: assign(({ context }) => ({
              acked: true,
              buzzer: false,
              lcdLines: sanitizeLines(['ACK RECU', 'UGA en attente'], context.lcdLines)
            }))
          }
        }
      },
      ugaActive: {
        on: {
          ACK: {
            actions: assign(({ context }) => ({
              acked: true,
              lcdLines: sanitizeLines([
                'ACK RECU',
                'UGA active',
                context.lcdLines[2] ?? '',
                context.lcdLines[3] ?? ''
              ], context.lcdLines)
            }))
          },
          STOP_UGA: {
            target: 'attenteReset',
            actions: assign(({ context }) => ({
              ugaActive: false,
              buzzer: false,
              lcdLines: sanitizeLines([
                'UGA ARRETEE',
                context.acked ? 'Attente reset' : 'Valider ACK',
                context.lcdLines[2] ?? '',
                context.lcdLines[3] ?? ''
              ], context.lcdLines)
            }))
          }
        }
      },
      attenteReset: {
        on: {
          ACK: {
            actions: assign(({ context }) => ({
              acked: true,
              lcdLines: sanitizeLines([
                'ACK RECU',
                'Reset possible',
                context.lcdLines[2] ?? '',
                context.lcdLines[3] ?? ''
              ], context.lcdLines)
            }))
          },
          RESET: {
            target: 'idle',
            guard: ({ context }) => context.acked && !context.ugaActive && context.dmRearmed && context.dasReady,
            actions: assign(() => ({
              buzzer: false,
              acked: false,
              lcdLines: ['SYSTEME PRET', '', '', '']
            }))
          }
        }
      }
    }
  }
);

export type CmsiState = typeof cmsiMachine;
export type CmsiContextType = CmsiContext;
export type CmsiEventType = CmsiEvent;
export type CmsiKeyModeType = CmsiKeyMode;
