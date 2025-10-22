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
  cmsiPhase: string;
  ugaActive: boolean;
  alimentation: string;
  dasStatus: Record<string, string>;
  timeline: { id: string; timestamp: number; message: string; category: string }[];
  score: number;
  awaitingReset: boolean;
  alarmStartedAt?: number;
  ackTimestamp?: number;
  outOfService: { zd: string[]; das: string[] };
};

type TrainerStore = {
  connectionStatus: ConnectionStatus;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  session?: SessionSnapshot;
  scenarios: Scenario[];
  connect: () => void;
  startScenario: (scenarioId: string) => void;
  triggerEvent: (event: ScenarioEvent) => void;
  stopScenario: () => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __VITE_META_ENV__: Record<string, string> | undefined;
}

const metaEnv = (globalThis as any).__VITE_META_ENV__ ?? ({} as Record<string, string>);
const WS_URL = metaEnv.VITE_SERVER_WS ?? process.env.VITE_SERVER_WS ?? 'ws://localhost:4500';
const API_URL = metaEnv.VITE_SERVER_API ?? process.env.VITE_SERVER_API ?? 'http://localhost:4500';

let socket: WebSocket | undefined;

export const useTrainerStore = create<TrainerStore>((set, get) => ({
  connectionStatus: 'idle',
  sessionId: 'formation-demo',
  trainerId: 'trainer-demo',
  traineeId: 'trainee-demo',
  scenarios: [],
  connect: async () => {
    if (get().connectionStatus === 'connected') return;
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
            sessionId: get().sessionId,
            role: 'trainer',
            userId: get().trainerId
          })
        );
        set({ connectionStatus: 'connected' });
      });

      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_STATE') {
          set({ session: data.payload });
        }
      });

      socket.addEventListener('close', () => set({ connectionStatus: 'error' }));
    }
  },
  startScenario: (scenarioId) => {
    const { sessionId, trainerId, traineeId } = get();
    socket?.send(
      JSON.stringify({
        type: 'START_SCENARIO',
        sessionId,
        scenarioId,
        trainerId,
        traineeId
      })
    );
  },
  triggerEvent: (event) => {
    socket?.send(
      JSON.stringify({
        type: 'TRIGGER_EVENT',
        sessionId: get().sessionId,
        event
      })
    );
  },
  stopScenario: () => {
    socket?.send(JSON.stringify({ type: 'STOP_SCENARIO', sessionId: get().sessionId }));
  }
}));
