import { create } from 'zustand';
import type { AccessLevel, Scenario, ScenarioEvent, User } from '@ssi/shared-models';

const sessionIdForUser = (user: User) => `session-${user.id}`;

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type SessionSnapshot = {
  id: string;
  scenarioId?: string;
  scenarioDefinition?: Scenario;
  runId?: string;
  trainerId?: string;
  traineeId?: string;
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
  accessLevel: AccessLevel;
};

type AuthState = {
  user: User;
  token: string;
};

type SessionStore = {
  auth?: AuthState;
  authError?: string;
  connectionStatus: ConnectionStatus;
  sessionId?: string;
  session?: SessionSnapshot;
  scenarios: Scenario[];
  connect: () => Promise<void>;
  disconnect: () => void;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  register: (payload: { name: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
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

export const mergeScenarioDefinition = (scenarios: Scenario[], scenario: Scenario): Scenario[] => {
  const existingIndex = scenarios.findIndex((item) => item.id === scenario.id);
  if (existingIndex === -1) {
    return [...scenarios, scenario];
  }
  return scenarios.map((item, index) => (index === existingIndex ? scenario : item));
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  auth: undefined,
  authError: undefined,
  connectionStatus: 'idle',
  sessionId: undefined,
  scenarios: [],
  session: undefined,
  async connect() {
    const { auth, connectionStatus, sessionId } = get();
    if (!auth) return;
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      return;
    }

    const resolvedSessionId = sessionId ?? sessionIdForUser(auth.user);
    set({ connectionStatus: 'connecting', sessionId: resolvedSessionId });

    if (typeof fetch !== 'undefined') {
      try {
        const response = await fetch(`${API_URL}/api/scenarios`);
        const scenarios: Scenario[] = await response.json();
        set({ scenarios });
      } catch (error) {
        console.error('Failed to load scenarios', error);
      }
    }

    if (typeof WebSocket !== 'undefined') {
      socket = new WebSocket(WS_URL);
      socket.addEventListener('open', () => {
        socket?.send(
          JSON.stringify({
            type: 'INIT',
            sessionId: resolvedSessionId,
            role: 'trainee',
            token: auth.token
          })
        );
        set({ connectionStatus: 'connected' });
      });

      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_STATE') {
          set((state) => ({
            session: data.payload,
            scenarios: data.payload?.scenarioDefinition
              ? mergeScenarioDefinition(state.scenarios, data.payload.scenarioDefinition)
              : state.scenarios
          }));
        }
        if (data.type === 'ERROR') {
          console.error(data.message);
        }
      });

      socket.addEventListener('close', () => {
        socket = undefined;
        const hasAuth = Boolean(get().auth);
        set({ connectionStatus: hasAuth ? 'error' : 'idle' });
      });
    }
  },
  disconnect() {
    if (socket) {
      socket.close();
      socket = undefined;
    }
    set({ connectionStatus: 'idle', session: undefined });
  },
  async login({ email, password }) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? 'Identifiants incorrects.' });
        return false;
      }
      const payload = (await response.json()) as { user: User; token: string };
      set({
        auth: payload,
        authError: undefined,
        sessionId: sessionIdForUser(payload.user)
      });
      return true;
    } catch (error) {
      console.error('Login error', error);
      set({ authError: 'Connexion impossible. Veuillez réessayer.' });
      return false;
    }
  },
  async register({ name, email, password }) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'TRAINEE' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? 'Inscription impossible.' });
        return false;
      }
      const payload = (await response.json()) as { user: User; token: string };
      set({
        auth: payload,
        authError: undefined,
        sessionId: sessionIdForUser(payload.user)
      });
      return true;
    } catch (error) {
      console.error('Register error', error);
      set({ authError: "Impossible de créer le compte." });
      return false;
    }
  },
  logout() {
    get().disconnect();
    set({ auth: undefined, sessionId: undefined, authError: undefined });
  },
  clearError() {
    set({ authError: undefined });
  },
  ack() {
    const { sessionId, auth } = get();
    if (!auth || !sessionId) return;
    socket?.send(JSON.stringify({ type: 'ACK', sessionId, token: auth.token }));
  },
  reset() {
    const { sessionId, auth } = get();
    if (!auth || !sessionId) return;
    socket?.send(JSON.stringify({ type: 'RESET', sessionId, token: auth.token }));
  },
  stopUGA() {
    const { sessionId, auth } = get();
    if (!auth || !sessionId) return;
    socket?.send(JSON.stringify({ type: 'UGA_STOP', sessionId, token: auth.token }));
  },
  setOutOfService({ targetType, targetId, active, label }) {
    const { sessionId, auth } = get();
    if (!auth || !sessionId) return;
    socket?.send(
      JSON.stringify({
        type: 'SET_OUT_OF_SERVICE',
        sessionId,
        token: auth.token,
        targetType,
        targetId,
        active,
        label
      })
    );
  },
  triggerEvent(event) {
    const { sessionId, auth } = get();
    if (!auth || !sessionId) return;
    socket?.send(
      JSON.stringify({
        type: 'TRIGGER_EVENT',
        sessionId,
        token: auth.token,
        event
      })
    );
  }
}));
