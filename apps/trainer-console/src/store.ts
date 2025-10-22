import { create } from 'zustand';
import type { Scenario, ScenarioEvent, User } from '@ssi/shared-models';

const sessionIdForTrainee = (traineeId: string) => `session-${traineeId}`;

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type SessionSnapshot = {
  id: string;
  scenarioId?: string;
  runId?: string;
  trainerId?: string;
  traineeId?: string;
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
  activeAlarms: { dm: string[]; dai: string[] };
  accessLevel: AccessLevel;
};

type AuthState = {
  user: User;
  token: string;
};

type TrainerStore = {
  auth?: AuthState;
  authError?: string;
  connectionStatus: ConnectionStatus;
  sessionId?: string;
  session?: SessionSnapshot;
  scenarios: Scenario[];
  trainees: User[];
  selectedTraineeId?: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  register: (payload: { name: string; email: string; password: string }) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  fetchScenarios: () => Promise<void>;
  fetchTrainees: () => Promise<void>;
  selectTrainee: (traineeId: string) => void;
  startScenario: (scenarioId: string) => void;
  triggerEvent: (event: ScenarioEvent) => void;
  stopScenario: () => void;
  createTrainee: (payload: { name: string; email: string; password: string }) => Promise<boolean>;
};

declare global {
  // eslint-disable-next-line no-var
  var __VITE_META_ENV__: Record<string, string> | undefined;
}

const metaEnv = (globalThis as any).__VITE_META_ENV__ ?? ({} as Record<string, string | undefined>);
const nodeEnv = (globalThis as any).process?.env ?? ({} as Record<string, string | undefined>);
const WS_URL = metaEnv.VITE_SERVER_WS ?? nodeEnv.VITE_SERVER_WS ?? 'ws://localhost:4500';
const API_URL = metaEnv.VITE_SERVER_API ?? nodeEnv.VITE_SERVER_API ?? 'http://localhost:4500';

let socket: WebSocket | undefined;

export const useTrainerStore = create<TrainerStore>((set, get) => ({
  auth: undefined,
  authError: undefined,
  connectionStatus: 'idle',
  sessionId: undefined,
  session: undefined,
  scenarios: [],
  trainees: [],
  selectedTraineeId: undefined,
  async connect() {
    const { auth, sessionId, connectionStatus } = get();
    if (!auth || !sessionId) return;
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      return;
    }

    set({ connectionStatus: 'connecting' });

    await get().fetchScenarios();

    if (typeof WebSocket !== 'undefined') {
      socket = new WebSocket(WS_URL);
      socket.addEventListener('open', () => {
        socket?.send(
          JSON.stringify({
            type: 'INIT',
            sessionId,
            role: 'trainer',
            token: auth.token
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

      socket.addEventListener('close', () => {
        socket = undefined;
        const hasSession = Boolean(get().auth && get().sessionId);
        set({ connectionStatus: hasSession ? 'error' : 'idle' });
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
        authError: undefined
      });
      await get().fetchTrainees();
      await get().fetchScenarios();
      return true;
    } catch (error) {
      console.error('Trainer login error', error);
      set({ authError: 'Connexion impossible. Veuillez réessayer.' });
      return false;
    }
  },
  async register({ name, email, password }) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'TRAINER' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? "Inscription formateur impossible." });
        return false;
      }
      const payload = (await response.json()) as { user: User; token: string };
      set({ auth: payload, authError: undefined });
      await get().fetchTrainees();
      await get().fetchScenarios();
      return true;
    } catch (error) {
      console.error('Trainer register error', error);
      set({ authError: "Impossible de créer le compte formateur." });
      return false;
    }
  },
  logout() {
    get().disconnect();
    set({ auth: undefined, sessionId: undefined, selectedTraineeId: undefined, authError: undefined });
  },
  clearError() {
    set({ authError: undefined });
  },
  async fetchScenarios() {
    if (typeof fetch === 'undefined') return;
    try {
      const response = await fetch(`${API_URL}/api/scenarios`);
      const scenarios: Scenario[] = await response.json();
      set({ scenarios });
    } catch (error) {
      console.error('Failed to load scenarios', error);
    }
  },
  async fetchTrainees() {
    const { auth } = get();
    if (!auth || typeof fetch === 'undefined') return;
    try {
      const response = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        throw new Error('Unable to fetch trainees');
      }
      const trainees = (await response.json()) as User[];
      set({ trainees });
    } catch (error) {
      console.error('Failed to load trainees', error);
    }
  },
  selectTrainee(traineeId) {
    const newSessionId = sessionIdForTrainee(traineeId);
    const { connectionStatus } = get();
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      get().disconnect();
    }
    set({ selectedTraineeId: traineeId, sessionId: newSessionId, session: undefined });
  },
  startScenario(scenarioId) {
    const { selectedTraineeId, sessionId, auth } = get();
    if (!selectedTraineeId || !sessionId || !auth) return;
    socket?.send(
      JSON.stringify({
        type: 'START_SCENARIO',
        sessionId,
        scenarioId,
        traineeId: selectedTraineeId,
        token: auth.token
      })
    );
  },
  triggerEvent(event) {
    const { sessionId, auth } = get();
    if (!sessionId || !auth) return;
    socket?.send(
      JSON.stringify({
        type: 'TRIGGER_EVENT',
        sessionId,
        token: auth.token,
        event
      })
    );
  },
  stopScenario() {
    const { sessionId, auth } = get();
    if (!sessionId || !auth) return;
    socket?.send(JSON.stringify({ type: 'STOP_SCENARIO', sessionId, token: auth.token }));
  },
  async createTrainee({ name, email, password }) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'TRAINEE' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? 'Impossible de créer cet apprenant.' });
        return false;
      }
      await get().fetchTrainees();
      return true;
    } catch (error) {
      console.error('Create trainee error', error);
      set({ authError: 'Création du compte apprenant impossible.' });
      return false;
    }
  }
}));
