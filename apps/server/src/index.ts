import cors from 'cors';
import express from 'express';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
import { defaultScenarios, Scenario, ScenarioEvent } from '@ssi/shared-models';
import { v4 as uuid } from 'uuid';

const parseJson = <T>(value: string | null | undefined): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON value', error);
    return undefined;
  }
};

interface TimelineEntry {
  id: string;
  timestamp: number;
  message: string;
  category: 'event' | 'action' | 'system';
}

type ScenarioConfig = {
  t1?: number;
  t2?: number;
  zd?: Array<Record<string, unknown>>;
  zf?: Array<Record<string, unknown>>;
  das?: Array<Record<string, unknown>>;
  peripherals?: Array<Record<string, unknown>>;
};

interface SessionState {
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
  timeline: TimelineEntry[];
  score: number;
  awaitingReset: boolean;
  alarmStartedAt?: number;
  ackTimestamp?: number;
  outOfService: { zd: string[]; das: string[] };
  activeAlarms: { dm: string[]; dai: string[] };
  accessLevel: AccessLevel;
}

interface Session {
  state: SessionState;
  trainers: Set<WebSocket>;
  trainees: Set<WebSocket>;
  tick?: NodeJS.Timeout;
}

type ClientRole = 'trainer' | 'trainee';

type ClientMessage =
  | { type: 'INIT'; sessionId: string; role: ClientRole; userId?: string }
  | {
      type: 'START_SCENARIO';
      sessionId: string;
      scenarioId: string;
      trainerId: string;
      traineeId: string;
      scenario?: Scenario;
    }
  | { type: 'TRIGGER_EVENT'; sessionId: string; event: ScenarioEvent }
  | { type: 'SET_ACCESS_LEVEL'; sessionId: string; level: AccessLevel; trainerId: string }
  | { type: 'ACK'; sessionId: string; userId: string }
  | { type: 'RESET'; sessionId: string; userId: string }
  | { type: 'UGA_STOP'; sessionId: string; userId: string }
  | {
      type: 'SET_OUT_OF_SERVICE';
      sessionId: string;
      userId: string;
      targetType: 'zd' | 'das';
      targetId: string;
      active: boolean;
      label?: string;
    }
  | { type: 'STOP_SCENARIO'; sessionId: string };

type ServerMessage =
  | { type: 'SESSION_STATE'; payload: SessionState }
  | { type: 'ERROR'; message: string };

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map<string, Session>();

const addTimeline = (session: Session, message: string, category: TimelineEntry['category']): void => {
  session.state.timeline.push({ id: uuid(), timestamp: Date.now(), message, category });
};

const broadcast = (session: Session): void => {
  const payload: ServerMessage = { type: 'SESSION_STATE', payload: session.state };
  const data = JSON.stringify(payload);
  [...session.trainers, ...session.trainees].forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

const resetTick = (session: Session) => {
  if (session.tick) {
    clearInterval(session.tick);
    session.tick = undefined;
  }
};

const scheduleTick = (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return;
  resetTick(session);
  session.tick = setInterval(() => handleTick(sessionId), 1000);
};

const handleTick = (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return;
  const state = session.state;
  if (state.cmsiPhase === 'preAlerte' && state.t1Remaining !== undefined) {
    state.t1Remaining = Math.max(0, (state.t1Remaining ?? 0) - 1);
    if (state.t1Remaining === 0) {
      state.cmsiPhase = 'alerte';
      addTimeline(session, 'Passage en ALERTE (T2)', 'system');
    }
  } else if (state.cmsiPhase === 'alerte' && state.t2Remaining !== undefined) {
    state.t2Remaining = Math.max(0, (state.t2Remaining ?? 0) - 1);
    if (state.t2Remaining === 0) {
      state.cmsiPhase = 'ugaActive';
      state.ugaActive = true;
      addTimeline(session, 'UGA activée automatiquement', 'system');
    }
  } else {
    resetTick(session);
  }
  broadcast(session);
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/scenarios', async (_req, res) => {
  const scenarios = await prisma.scenario.findMany({
    include: { events: true }
  });
  if (scenarios.length === 0) {
    return res.json(defaultScenarios);
  }
  const mapped = scenarios.map((scenario) => {
    const config = parseJson<ScenarioConfig>(scenario.config) ?? {};
    return {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      t1: config.t1 ?? 15,
      t2: config.t2 ?? 5,
      zd: config.zd ?? [],
      zf: config.zf ?? [],
      das: config.das ?? [],
      peripherals: config.peripherals ?? [],
      events: scenario.events.map((event) => ({
        id: event.id,
        scenarioId: scenario.id,
        timestamp: event.offset,
        type: event.type as ScenarioEvent['type'],
        payload: parseJson<Record<string, unknown>>(event.payload) ?? {}
      }))
    };
  });
  res.json(mapped);
});

app.get('/api/runs/:runId', async (req, res) => {
  const run = await prisma.run.findUnique({
    where: { id: req.params.runId },
    include: { scores: true, actions: true }
  });
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json({
    ...run,
    actions: run.actions.map((action) => ({
      ...action,
      payload: parseJson<Record<string, unknown>>(action.payload) ?? {}
    }))
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const ensureSession = (sessionId: string): Session => {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      trainers: new Set(),
      trainees: new Set(),
      state: {
        id: sessionId,
        cmsiPhase: 'idle',
        ugaActive: false,
        alimentation: 'secteur',
        dasStatus: {},
        timeline: [],
        score: 0,
        awaitingReset: false,
        outOfService: { zd: [], das: [] },
        activeAlarms: { dm: [], dai: [] },
        accessLevel: 0
      }
    };
    sessions.set(sessionId, session);
  }
  return session;
};

const persistAction = async (session: Session, type: string, payload: Record<string, unknown>) => {
  if (!session.state.runId) return;
  await prisma.action.create({
    data: {
      runId: session.state.runId,
      type,
      payload: JSON.stringify(payload ?? {})
    }
  });
};

const persistScore = async (session: Session, label: string, delta: number) => {
  if (!session.state.runId) return;
  await prisma.score.create({
    data: {
      runId: session.state.runId,
      label,
      delta
    }
  });
};

const updateScore = async (session: Session, label: string, delta: number) => {
  session.state.score += delta;
  await persistScore(session, label, delta);
};

const evaluateAck = async (session: Session) => {
  const { alarmStartedAt, ackTimestamp, scenarioId } = session.state;
  if (!alarmStartedAt || !ackTimestamp || !scenarioId) return;
  const duration = (ackTimestamp - alarmStartedAt) / 1000;
  if (duration <= 15) {
    await updateScore(session, 'Acquittement < 15 s', 20);
  }
};

const evaluateSequence = async (session: Session) => {
  if (session.state.cmsiPhase === 'retourNormal' && !session.state.awaitingReset) {
    await updateScore(session, 'Séquence opérationnelle complète', 30);
  }
};

const handleTriggerEvent = async (session: Session, event: ScenarioEvent) => {
  addTimeline(session, `Événement: ${event.type}`, 'event');
  switch (event.type) {
    case 'ALARME_DM':
    case 'ALARME_DAI':
      session.state.cmsiPhase = 'preAlerte';
      session.state.t1Remaining = session.state.t1;
      session.state.t2Remaining = session.state.t2;
      session.state.alarmStartedAt = Date.now();
      session.state.awaitingReset = true;
      {
        const zoneId = typeof event.payload?.zdId === 'string' ? (event.payload.zdId as string) : undefined;
        if (zoneId) {
          const key = event.type === 'ALARME_DM' ? 'dm' : 'dai';
          const current = new Set(session.state.activeAlarms[key]);
          current.add(zoneId);
          session.state.activeAlarms = {
            ...session.state.activeAlarms,
            [key]: Array.from(current)
          };
        }
      }
      scheduleTick(session.state.id);
      break;
    case 'DEFAUT_LIGNE':
      addTimeline(session, 'Défaut de ligne signalé', 'system');
      break;
    case 'COUPURE_SECTEUR':
      session.state.alimentation = 'batterie';
      addTimeline(session, 'Bascule sur batterie', 'system');
      break;
    case 'DAS_BLOQUE':
      if (event.payload?.dasId) {
        session.state.dasStatus[event.payload.dasId as string] = 'defaut';
      }
      addTimeline(session, 'Défaut position DAS', 'system');
      break;
    case 'UGA_HORS_SERVICE':
      session.state.ugaActive = false;
      addTimeline(session, 'UGA hors service', 'system');
      break;
  }
  await persistAction(session, 'TRIGGER_EVENT', { type: event.type, payload: event.payload });
};

const handleMessage = async (ws: WebSocket, message: ClientMessage) => {
  switch (message.type) {
    case 'INIT': {
      const session = ensureSession(message.sessionId);
      if (message.role === 'trainer') {
        session.trainers.add(ws);
      } else {
        session.trainees.add(ws);
      }
      broadcast(session);
      break;
    }
    case 'START_SCENARIO': {
      const session = ensureSession(message.sessionId);
      resetTick(session);
      const scenario = message.scenario ?? defaultScenarios.find((s) => s.id === message.scenarioId);
      if (!scenario) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Scenario inconnu' } satisfies ServerMessage));
      }
      session.state = {
        ...session.state,
        scenarioId: scenario.id,
        t1: scenario.t1,
        t2: scenario.t2,
        t1Remaining: scenario.t1,
        t2Remaining: scenario.t2,
        cmsiPhase: 'idle',
        ugaActive: false,
        alimentation: 'secteur',
        dasStatus: Object.fromEntries(scenario.das.map((das) => [das.id, das.status])),
        timeline: [],
        score: 0,
        awaitingReset: false,
        alarmStartedAt: undefined,
        ackTimestamp: undefined,
        id: session.state.id,
        outOfService: { zd: [], das: [] },
        activeAlarms: { dm: [], dai: [] },
        accessLevel: 0
      };
      addTimeline(session, `Scénario "${scenario.name}" démarré`, 'system');
      const run = await prisma.run.create({
        data: {
          scenarioId: scenario.id,
          traineeId: message.traineeId,
          trainerId: message.trainerId,
          status: 'running'
        }
      });
      session.state.runId = run.id;
      await persistAction(session, 'START_SCENARIO', { scenarioId: scenario.id });
      broadcast(session);
      break;
    }
    case 'SET_ACCESS_LEVEL': {
      const session = ensureSession(message.sessionId);
      const nextLevel = Math.max(0, Math.min(message.level, 3)) as AccessLevel;
      session.state.accessLevel = nextLevel;
      const label = getAccessLevelLabel(nextLevel);
      addTimeline(
        session,
        nextLevel === 0
          ? 'Accès SSI verrouillé par le formateur'
          : `Niveau d'accès ${label} activé par le formateur`,
        'action'
      );
      await persistAction(session, 'SET_ACCESS_LEVEL', {
        trainerId: message.trainerId,
        level: nextLevel
      });
      broadcast(session);
      break;
    }
    case 'TRIGGER_EVENT': {
      const session = ensureSession(message.sessionId);
      await handleTriggerEvent(session, message.event);
      broadcast(session);
      break;
    }
    case 'ACK': {
      const session = ensureSession(message.sessionId);
      session.state.cmsiPhase = 'retourNormal';
      session.state.ackTimestamp = Date.now();
      session.state.ugaActive = false;
      addTimeline(session, 'Acquittement réalisé', 'action');
      await persistAction(session, 'ACK', { userId: message.userId });
      await evaluateAck(session);
      broadcast(session);
      break;
    }
    case 'RESET': {
      const session = ensureSession(message.sessionId);
      session.state.awaitingReset = false;
      session.state.cmsiPhase = 'idle';
      session.state.alimentation = 'secteur';
      session.state.dasStatus = Object.fromEntries(Object.keys(session.state.dasStatus).map((id) => [id, 'en_position']));
      session.state.t1Remaining = session.state.t1;
      session.state.t2Remaining = session.state.t2;
      session.state.activeAlarms = { dm: [], dai: [] };
      addTimeline(session, 'Réarmement effectué', 'action');
      await persistAction(session, 'RESET', { userId: message.userId });
      await evaluateSequence(session);
      broadcast(session);
      break;
    }
    case 'UGA_STOP': {
      const session = ensureSession(message.sessionId);
      session.state.ugaActive = false;
      addTimeline(session, 'Arrêt UGA manuel', 'action');
      await persistAction(session, 'UGA_STOP', { userId: message.userId });
      await updateScore(session, 'Arrêt UGA prématuré', -25);
      broadcast(session);
      break;
    }
    case 'SET_OUT_OF_SERVICE': {
      const session = ensureSession(message.sessionId);
      const { targetType, targetId, active, label } = message;
      const current = session.state.outOfService[targetType] ?? [];
      const updated = active
        ? Array.from(new Set([...current, targetId]))
        : current.filter((id) => id !== targetId);
      session.state.outOfService = {
        ...session.state.outOfService,
        [targetType]: updated
      };
      const name = label ?? targetId;
      const actionLabel = targetType === 'zd' ? 'Zone' : 'DAS';
      addTimeline(
        session,
        `${actionLabel} ${active ? 'mise hors service' : 'remise en service'} (${name})`,
        'action'
      );
      await persistAction(session, 'SET_OUT_OF_SERVICE', {
        targetType,
        targetId,
        active,
        label,
        userId: message.userId
      });
      broadcast(session);
      break;
    }
    case 'STOP_SCENARIO': {
      const session = ensureSession(message.sessionId);
      resetTick(session);
      if (session.state.awaitingReset) {
        await updateScore(session, 'Absence de réarmement', -10);
      }
      session.state.awaitingReset = false;
      session.state.cmsiPhase = 'idle';
      session.state.ugaActive = false;
      session.state.activeAlarms = { dm: [], dai: [] };
      session.state.accessLevel = 0;
      addTimeline(session, 'Scénario arrêté', 'system');
      if (session.state.runId) {
        await prisma.run.update({
          where: { id: session.state.runId },
          data: {
            endedAt: new Date(),
            status: 'completed',
            score: session.state.score
          }
        });
      }
      broadcast(session);
      break;
    }
    default:
      break;
  }
};

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      handleMessage(ws, message);
    } catch (error) {
      console.error('Invalid message', error);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid payload' } satisfies ServerMessage));
    }
  });

  ws.on('close', () => {
    sessions.forEach((session) => {
      session.trainers.delete(ws);
      session.trainees.delete(ws);
    });
  });
});

const PORT = process.env.PORT || 4500;
server.listen(PORT, () => {
  console.log(`🚒 Serveur SSI en écoute sur le port ${PORT}`);
});
