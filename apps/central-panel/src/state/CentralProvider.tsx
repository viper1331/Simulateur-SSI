import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { alimentationMachine, cmsiMachine, dasMachine } from '@ssi/state-machines';
import type { ActorRefFrom, StateFrom } from 'xstate';

export type CentralEvent = {
  id: string;
  at: number;
  type: 'system' | 'action' | 'inject';
  message: string;
  details?: Record<string, unknown>;
};

type TimersSnapshot = {
  t1Initial?: number;
  t2Initial?: number;
};

type CentralContextValue = {
  cmsiService: ActorRefFrom<typeof cmsiMachine>;
  dasService: ActorRefFrom<typeof dasMachine>;
  alimentationService: ActorRefFrom<typeof alimentationMachine>;
  events: CentralEvent[];
  pushEvent: (entry: Omit<CentralEvent, 'id' | 'at'> & { at?: number }) => void;
  timers: TimersSnapshot;
  setTimers: (snapshot: TimersSnapshot) => void;
};

const CentralContext = createContext<CentralContextValue | undefined>(undefined);

const createId = () => `evt-${Math.random().toString(36).slice(2, 10)}`;

export const CentralProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const cmsiService = useActorRef(cmsiMachine);
  const dasService = useActorRef(dasMachine);
  const alimentationService = useActorRef(alimentationMachine);
  const [events, setEvents] = useState<CentralEvent[]>([]);
  const [timers, setTimersState] = useState<TimersSnapshot>({});

  const pushEvent = useCallback(
    ({ type, message, details, at }: Omit<CentralEvent, 'id' | 'at'> & { at?: number }) => {
      setEvents((previous) => [
        ...previous,
        {
          id: createId(),
          type,
          message,
          details,
          at: at ?? Date.now()
        }
      ]);
    },
    []
  );

  const setTimers = useCallback((snapshot: TimersSnapshot) => {
    setTimersState((previous) => ({ ...previous, ...snapshot }));
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const snapshot = cmsiService.getSnapshot() as any;
      if (snapshot.matches('preAlerte') || snapshot.matches('alerte')) {
        cmsiService.send({ type: 'TICK' });
      }
      dasService.send({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(tick);
  }, [cmsiService, dasService]);

  useEffect(() => {
    const subscription = dasService.subscribe((state: StateFrom<typeof dasMachine>) => {
      const ready = state.matches('enPosition');
      cmsiService.send({ type: 'DAS_POSITION', ready });
    });
    return () => subscription.unsubscribe();
  }, [cmsiService, dasService]);

  const value = useMemo<CentralContextValue>(
    () => ({ cmsiService, dasService, alimentationService, events, pushEvent, timers, setTimers }),
    [cmsiService, dasService, alimentationService, events, pushEvent, timers, setTimers]
  );

  return <CentralContext.Provider value={value}>{children}</CentralContext.Provider>;
};

export const useCentralContext = (): CentralContextValue => {
  const context = useContext(CentralContext);
  if (!context) {
    throw new Error('useCentralContext must be used within a CentralProvider');
  }
  return context;
};

export const useCentralSelector = <T,>(selector: (state: StateFrom<typeof cmsiMachine>) => T): T => {
  const { cmsiService } = useCentralContext();
  return useSelector(cmsiService, selector);
};

export const useDasSelector = <T,>(selector: (state: StateFrom<typeof dasMachine>) => T): T => {
  const { dasService } = useCentralContext();
  return useSelector(dasService, selector);
};

export const useAlimentationSelector = <T,>(
  selector: (state: StateFrom<typeof alimentationMachine>) => T
): T => {
  const { alimentationService } = useCentralContext();
  return useSelector(alimentationService, selector);
};

export const useCentralActions = () => {
  const { cmsiService, dasService, alimentationService, pushEvent, setTimers } = useCentralContext();

  return {
    triggerPreAlert: (options: { t1: number; t2: number; message?: string }) => {
      cmsiService.send({ type: 'TRIGGER_PREALERTE', ...options });
      setTimers({ t1Initial: options.t1, t2Initial: options.t2 });
      pushEvent({ type: 'inject', message: `Déclenchement préalerte ${options.message ?? ''}` });
    },
    acknowledge: () => {
      cmsiService.send({ type: 'ACK' });
      pushEvent({ type: 'action', message: 'Acquittement opérateur' });
    },
    forceEvacuation: () => {
      cmsiService.send({ type: 'FORCE_UGA' });
      pushEvent({ type: 'action', message: 'Commande évacuation générale' });
    },
    stopEvacuation: () => {
      cmsiService.send({ type: 'STOP_UGA' });
      pushEvent({ type: 'action', message: "Arrêt de l'UGA" });
    },
    resetSystem: () => {
      cmsiService.send({ type: 'RESET' });
      pushEvent({ type: 'action', message: 'Tentative de réarmement' });
    },
    toggleBuzzer: () => {
      cmsiService.send({ type: 'BUZZER_TOGGLE' });
      pushEvent({ type: 'action', message: 'Bascule buzzer' });
    },
    silenceBuzzer: () => {
      cmsiService.send({ type: 'SILENCE_BUZZER' });
      pushEvent({ type: 'action', message: 'Silence buzzer' });
    },
    testLamps: () => {
      pushEvent({ type: 'action', message: 'Test lampes façade' });
    },
    pushLcd: (lines: string[]) => {
      cmsiService.send({ type: 'LCD_PUSH', lines });
    },
    maskZone: (zone: string, active: boolean) => {
      cmsiService.send({ type: 'MASK_ZONE', zone, active });
      pushEvent({
        type: 'action',
        message: `${active ? 'Masquage' : 'Remise en service'} zone ${zone}`
      });
    },
    setDmStatus: (rearmed: boolean) => {
      cmsiService.send({ type: 'DM_STATUS', rearmed });
    },
    setDasIntermittent: (probability: number) => {
      dasService.send({ type: 'CONFIGURER_DEFAUT_INTERMITTENT', probability });
    },
    signalDasFault: () => {
      dasService.send({ type: 'SIGNALER_DEFAUT' });
      pushEvent({ type: 'inject', message: 'Défaut position DAS' });
    },
    confirmDasPosition: () => {
      dasService.send({ type: 'CONFIRMER_POSITION' });
      cmsiService.send({ type: 'DAS_POSITION', ready: true });
      pushEvent({ type: 'action', message: 'DAS confirmé en position' });
    },
    rearmDas: () => {
      dasService.send({ type: 'REARMER' });
      pushEvent({ type: 'action', message: 'Réarmement DAS' });
    },
    cutSector: () => {
      alimentationService.send({ type: 'COUPURE_SECTEUR' });
      pushEvent({ type: 'inject', message: 'Coupure secteur' });
    },
    restoreSector: () => {
      alimentationService.send({ type: 'RETOUR_SECTEUR' });
      pushEvent({ type: 'inject', message: 'Retour secteur' });
    },
    batteryLow: () => {
      alimentationService.send({ type: 'BATTERIE_FAIBLE' });
      pushEvent({ type: 'inject', message: 'Batterie faible' });
    },
    batteryOk: () => {
      alimentationService.send({ type: 'BATTERIE_OK' });
      pushEvent({ type: 'action', message: 'Batterie rétablie' });
    },
    toggleKeyMode: () => {
      const snapshot = cmsiService.getSnapshot();
      const current = snapshot.context.keyMode;
      const next = current === 'USER' ? 'AUTHOR' : 'USER';
      cmsiService.send({ type: 'SET_MODE', mode: next });
      pushEvent({ type: 'action', message: `Rotation clef -> mode ${next}` });
    },
    setKeyMode: (mode: 'USER' | 'AUTHOR') => {
      cmsiService.send({ type: 'SET_MODE', mode });
      pushEvent({ type: 'action', message: `Mode clef réglé sur ${mode}` });
    }
  };
};
