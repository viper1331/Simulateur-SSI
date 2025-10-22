import { create } from 'zustand';
import type { AccessLevel, Scenario, ScenarioEvent, User } from '@ssi/shared-models';
import logger from './logger';

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
  setAccessLevel: (level: AccessLevel) => void;
  updateScenario: (scenario: Scenario) => void;
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

    logger.info('Initialisation de la connexion formateur', { sessionId });
    set({ connectionStatus: 'connecting' });

    await get().fetchScenarios();

    if (typeof WebSocket !== 'undefined') {
      logger.debug('Ouverture du WebSocket', { wsUrl: WS_URL });
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
        logger.info('WebSocket connecté');
        set({ connectionStatus: 'connected' });
      });

      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        logger.debug('Message reçu du WebSocket', data);
        if (data.type === 'SESSION_STATE') {
          set({ session: data.payload });
        }
      });

      socket.addEventListener('close', () => {
        socket = undefined;
        const hasSession = Boolean(get().auth && get().sessionId);
        logger.warn('WebSocket fermé', { hasSession });
        set({ connectionStatus: hasSession ? 'error' : 'idle' });
      });

      socket.addEventListener('error', (event) => {
        logger.error('Erreur WebSocket', event);
      });
    }
  },
  disconnect() {
    if (socket) {
      logger.info('Fermeture de la connexion WebSocket demandée');
      socket.close();
      socket = undefined;
    }
    set({ connectionStatus: 'idle', session: undefined });
  },
  async login({ email, password }) {
    logger.info('Tentative de connexion formateur', { email });
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? 'Identifiants incorrects.' });
        logger.warn('Connexion formateur échouée', { email, status: response.status, error: payload?.error });
        return false;
      }
      const payload = (await response.json()) as { user: User; token: string };
      set({
        auth: payload,
        authError: undefined
      });
      logger.info('Connexion formateur réussie', { email });
      await get().fetchTrainees();
      await get().fetchScenarios();
      return true;
    } catch (error) {
      console.error('Trainer login error', error);
      logger.error('Erreur lors de la connexion formateur', error);
      set({ authError: 'Connexion impossible. Veuillez réessayer.' });
      return false;
    }
  },
  async register({ name, email, password }) {
    logger.info('Création d’un compte formateur', { email });
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'TRAINER' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? "Inscription formateur impossible." });
        logger.warn('Inscription formateur refusée', { email, status: response.status, error: payload?.error });
        return false;
      }
      const payload = (await response.json()) as { user: User; token: string };
      set({ auth: payload, authError: undefined });
      logger.info('Compte formateur créé', { email });
      await get().fetchTrainees();
      await get().fetchScenarios();
      return true;
    } catch (error) {
      console.error('Trainer register error', error);
      logger.error('Erreur lors de l’inscription formateur', error);
      set({ authError: "Impossible de créer le compte formateur." });
      return false;
    }
  },
  logout() {
    logger.info('Déconnexion du formateur demandée');
    get().disconnect();
    set({ auth: undefined, sessionId: undefined, selectedTraineeId: undefined, authError: undefined });
  },
  clearError() {
    set({ authError: undefined });
  },
  async fetchScenarios() {
    if (typeof fetch === 'undefined') return;
    try {
      logger.debug('Chargement des scénarios disponibles', { apiUrl: `${API_URL}/api/scenarios` });
      const response = await fetch(`${API_URL}/api/scenarios`);
      const scenarios: Scenario[] = await response.json();
      set({ scenarios });
      logger.info('Scénarios chargés', { total: scenarios.length });
    } catch (error) {
      console.error('Failed to load scenarios', error);
      logger.error('Erreur lors du chargement des scénarios', error);
    }
  },
  async fetchTrainees() {
    const { auth } = get();
    if (!auth || typeof fetch === 'undefined') return;
    try {
      logger.debug('Récupération des apprenants', { apiUrl: `${API_URL}/api/users?role=TRAINEE` });
      const response = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        throw new Error('Unable to fetch trainees');
      }
      const trainees = (await response.json()) as User[];
      set({ trainees });
      logger.info('Apprenants chargés', { total: trainees.length });
    } catch (error) {
      console.error('Failed to load trainees', error);
      logger.error('Erreur lors du chargement des apprenants', error);
    }
  },
  selectTrainee(traineeId) {
    const newSessionId = sessionIdForTrainee(traineeId);
    const { connectionStatus } = get();
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      get().disconnect();
    }
    logger.info('Sélection d’un apprenant', { traineeId, sessionId: newSessionId });
    set({ selectedTraineeId: traineeId, sessionId: newSessionId, session: undefined });
  },
  startScenario(scenarioId) {
    const { selectedTraineeId, sessionId, auth } = get();
    if (!selectedTraineeId || !sessionId || !auth) return;
    logger.info('Démarrage d’un scénario', { scenarioId, sessionId, traineeId: selectedTraineeId });
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
    logger.debug('Déclenchement d’un évènement', { event });
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
    logger.info('Arrêt du scénario en cours', { sessionId });
    socket?.send(JSON.stringify({ type: 'STOP_SCENARIO', sessionId, token: auth.token }));
  },
  async createTrainee({ name, email, password }) {
    logger.info('Création d’un compte apprenant', { email });
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'TRAINEE' })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined);
        set({ authError: payload?.error ?? 'Impossible de créer cet apprenant.' });
        logger.warn('Création du compte apprenant refusée', {
          email,
          status: response.status,
          error: payload?.error
        });
        return false;
      }
      await get().fetchTrainees();
      logger.info('Compte apprenant créé', { email });
      return true;
    } catch (error) {
      console.error('Create trainee error', error);
      logger.error('Erreur lors de la création du compte apprenant', error);
      set({ authError: 'Création du compte apprenant impossible.' });
      return false;
    }
  },
  setAccessLevel(level) {
    const { sessionId, auth } = get();
    if (!sessionId || !auth) {
      logger.warn('Impossible de modifier le niveau d’accès SSI', {
        hasSession: Boolean(sessionId),
        isAuthenticated: Boolean(auth)
      });
      return;
    }

    const nextLevel = Math.max(0, Math.min(level, 3)) as AccessLevel;
    logger.info('Changement du niveau d’accès SSI demandé', {
      sessionId,
      level: nextLevel
    });

    set((state) =>
      state.session
        ? {
            session: {
              ...state.session,
              accessLevel: nextLevel
            }
          }
        : {}
    );

    socket?.send(
      JSON.stringify({
        type: 'SET_ACCESS_LEVEL',
        sessionId,
        level: nextLevel,
        trainerId: auth.user.id,
        token: auth.token
      })
    );
  },
  updateScenario(updatedScenario) {
    logger.debug('Mise à jour locale du scénario', { scenarioId: updatedScenario.id });
    set((state) => ({
      scenarios: state.scenarios.map((scenario) =>
        scenario.id === updatedScenario.id ? updatedScenario : scenario
      )
    }));
  }
}));
