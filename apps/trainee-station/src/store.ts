import { create } from 'zustand';
import type { Scenario, ScenarioEvent } from '@ssi/shared-models';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type SessionSnapshot = {
  id: string;
  scenarioId?: string;
  runId?: string;
  t1?: number;
  t2?: number;
  t1Remaining?: number;
  t2Remaining?: number;
  cmsiPhase: 'idle' | 'preAlerte' | 'alerte' | 'ugaActive' | 'retourNormal';
  ugaActive: boolean;
  alimentation: 'secteur' | 'batterie' | 'defautBatterie';
  dasStatus: Record<string, 'en_position' | 'commande' | 'defaut'>;
  timeline: { id: string; timestamp: number; message: string; category: string }[];
  score: number;
  awaitingReset: boolean;
  alarmStartedAt?: number;
  ackTimestamp?: number;
  outOfService: { zd: string[]; das: string[] };
  activeAlarms: { dm: string[]; dai: string[] };
};

type SessionStore = {
  connectionStatus: ConnectionStatus;
  sessionId: string;
  userId: string;
  session?: SessionSnapshot;
  scenarios: Scenario[];
  connect: () => void;
  ack: () => void;
  reset: () => void;
  stopUGA: () => void;
  setOutOfService: (options: {
    targetType: 'zd' | 'das';
    targetId: string;
    active: boolean;
    label?: string;
  }) => void;
  triggerEvent: (event: ScenarioEvent) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __VITE_META_ENV__: Record<string, string> | undefined;
}

const metaEnv = ((globalThis as any).__VITE_META_ENV__ ?? {}) as Record<string, string | undefined>;
const nodeEnv = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
const WS_URL = metaEnv.VITE_SERVER_WS ?? nodeEnv.VITE_SERVER_WS ?? 'ws://localhost:4500';
const API_URL = metaEnv.VITE_SERVER_API ?? nodeEnv.VITE_SERVER_API ?? 'http://localhost:4500';

let socket: WebSocket | undefined;

export const useSessionStore = create<SessionStore>((set, get) => ({
  connectionStatus: 'idle',
  sessionId: 'formation-demo',
  userId: 'trainee-demo',
  scenarios: [],
  connect: async () => {
    const { connectionStatus, sessionId } = get();
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      return;
    }
    set({ connectionStatus: 'connecting' });
    if (typeof fetch !== 'undefined') {
      const response = await fetch(`${API_URL}/api/scenarios`);
      const scenarios: Scenario[] = await response.json();
      set({ scenarios });
    }

    if (typeof WebSocket !== 'undefined') {
      socket = new WebSocket(WS_URL);
      socket.addEventListener('open', () => {
        socket?.send(
          JSON.stringify({
            type: 'INIT',
            sessionId,
            role: 'trainee',
            userId: get().userId
          })
        );
        set({ connectionStatus: 'connected' });
      });

      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_STATE') {
          set({ session: data.payload });
        }
        if (data.type === 'ERROR') {
          console.error(data.message);
        }
      });

      socket.addEventListener('close', () => {
        set({ connectionStatus: 'error' });
      });
    }
  },
  ack: () => {
    const { sessionId, userId } = get();
    socket?.send(JSON.stringify({ type: 'ACK', sessionId, userId }));
  },
  reset: () => {
    const { sessionId, userId } = get();
    socket?.send(JSON.stringify({ type: 'RESET', sessionId, userId }));
  },
  stopUGA: () => {
    const { sessionId, userId } = get();
    socket?.send(JSON.stringify({ type: 'UGA_STOP', sessionId, userId }));
  },
  setOutOfService: ({ targetType, targetId, active, label }) => {
    const { sessionId, userId } = get();
    socket?.send(
      JSON.stringify({
        type: 'SET_OUT_OF_SERVICE',
        sessionId,
        userId,
        targetType,
        targetId,
        active,
        label
      })
    );
  },
  triggerEvent: (event) => {
    const { sessionId } = get();
    socket?.send(
      JSON.stringify({
        type: 'TRIGGER_EVENT',
        sessionId,
        event
      })
    );
  }
}));
