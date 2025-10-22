import cors from 'cors';
import express from 'express';
import http from 'http';
import { PrismaClient, UserRole as PrismaUserRole } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';
import { defaultScenarios, ScenarioEvent, userRoleSchema, userSchema } from '@ssi/shared-models';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

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
  | { type: 'INIT'; sessionId: string; role: ClientRole; token: string }
  | { type: 'START_SCENARIO'; sessionId: string; scenarioId: string; traineeId: string; token: string }
  | { type: 'TRIGGER_EVENT'; sessionId: string; event: ScenarioEvent; token: string }
  | { type: 'ACK'; sessionId: string; token: string }
  | { type: 'RESET'; sessionId: string; token: string }
  | { type: 'UGA_STOP'; sessionId: string; token: string }
  | {
      type: 'SET_OUT_OF_SERVICE';
      sessionId: string;
      token: string;
      targetType: 'zd' | 'das';
      targetId: string;
      active: boolean;
      label?: string;
    }
  | { type: 'STOP_SCENARIO'; sessionId: string; token: string };

type ServerMessage =
  | { type: 'SESSION_STATE'; payload: SessionState }
  | { type: 'ERROR'; message: string };

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? 'development-secret';

type SanitizedUser = z.infer<typeof userSchema>;

const registrationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const roleByClientRole: Record<ClientRole, PrismaUserRole> = {
  trainer: 'TRAINER',
  trainee: 'TRAINEE'
};

const sendWsError = (ws: WebSocket, message: string) => {
  ws.send(JSON.stringify({ type: 'ERROR', message } satisfies ServerMessage));
};

const sanitizeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: PrismaUserRole;
  createdAt: Date;
}): SanitizedUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString()
});

const createToken = (user: { id: string; role: PrismaUserRole }) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });

const verifyToken = async (token: string) => {
  const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: PrismaUserRole };
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new Error('Utilisateur introuvable');
  }
  return user;
};

const requireUserForRole = async (token: string, expectedRole?: PrismaUserRole) => {
  const user = await verifyToken(token);
  if (expectedRole && user.role !== expectedRole) {
    throw new Error('Rôle incompatible');
  }
  return user;
};

type AuthenticatedRequest = express.Request & { user?: SanitizedUser; token?: string };

const authenticate: express.RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const token = header.slice(7);
  try {
    const user = await verifyToken(token);
    (req as AuthenticatedRequest).user = sanitizeUser(user);
    (req as AuthenticatedRequest).token = token;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};
const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map<string, Session>();

app.post('/api/auth/register', async (req, res) => {
  try {
    const payload = registrationSchema.parse(req.body);
    const normalizedEmail = payload.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: normalizedEmail,
        passwordHash,
        role: payload.role
      }
    });
    const token = createToken(user);
    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Requête invalide', details: error.flatten() });
    }
    console.error('Registration error', error);
    res.status(500).json({ error: "Impossible de créer le compte." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);
    const normalizedEmail = payload.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const isValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const token = createToken(user);
    res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Requête invalide', details: error.flatten() });
    }
    console.error('Login error', error);
    res.status(500).json({ error: "Impossible de se connecter." });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ user: authReq.user });
});

app.get('/api/users', authenticate, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  if (authReq.user.role !== 'TRAINER') {
    return res.status(403).json({ error: 'Accès réservé aux formateurs.' });
  }
  const roleQuery = typeof req.query.role === 'string' ? req.query.role.toUpperCase() : undefined;
  const parsedRole = roleQuery ? userRoleSchema.safeParse(roleQuery) : undefined;
  const where = parsedRole?.success ? { role: parsedRole.data as PrismaUserRole } : {};
  const users = await prisma.user.findMany({ where, orderBy: { name: 'asc' } });
  res.json(users.map(sanitizeUser));
});

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
      try {
        const user = await requireUserForRole(message.token, roleByClientRole[message.role]);
        const session = ensureSession(message.sessionId);
        if (message.role === 'trainer') {
          session.trainers.add(ws);
          session.state.trainerId = user.id;
        } else {
          session.trainees.add(ws);
          session.state.traineeId = user.id;
        }
        broadcast(session);
      } catch (error) {
        console.error('INIT error', error);
        sendWsError(ws, "Authentification websocket refusée.");
        ws.close();
      }
      break;
    }
    case 'START_SCENARIO': {
      try {
        const trainer = await requireUserForRole(message.token, 'TRAINER');
        const trainee = await prisma.user.findUnique({ where: { id: message.traineeId } });
        if (!trainee || trainee.role !== 'TRAINEE') {
          return sendWsError(ws, 'Apprenant introuvable.');
        }
        const session = ensureSession(message.sessionId);
        resetTick(session);
        const scenario = defaultScenarios.find((s) => s.id === message.scenarioId);
        if (!scenario) {
          return sendWsError(ws, 'Scénario inconnu.');
        }
        session.state = {
          ...session.state,
          scenarioId: scenario.id,
          trainerId: trainer.id,
          traineeId: trainee.id,
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
          activeAlarms: { dm: [], dai: [] }
        };
        addTimeline(session, `Scénario "${scenario.name}" démarré`, 'system');
        const run = await prisma.run.create({
          data: {
            scenarioId: scenario.id,
            traineeId: trainee.id,
            trainerId: trainer.id,
            status: 'running'
          }
        });
        session.state.runId = run.id;
        await persistAction(session, 'START_SCENARIO', {
          scenarioId: scenario.id,
          trainerId: trainer.id,
          traineeId: trainee.id
        });
        broadcast(session);
      } catch (error) {
        console.error('START_SCENARIO error', error);
        sendWsError(ws, error instanceof Error ? error.message : 'Erreur lors du démarrage du scénario.');
      }
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
      try {
        await requireUserForRole(message.token, 'TRAINER');
        const session = ensureSession(message.sessionId);
        await handleTriggerEvent(session, message.event);
        broadcast(session);
      } catch (error) {
        console.error('TRIGGER_EVENT error', error);
        sendWsError(ws, 'Action non autorisée.');
      }
      break;
    }
    case 'ACK': {
      try {
        const user = await requireUserForRole(message.token);
        const session = ensureSession(message.sessionId);
        session.state.cmsiPhase = 'retourNormal';
        session.state.ackTimestamp = Date.now();
        session.state.ugaActive = false;
        addTimeline(session, `Acquittement réalisé par ${user.name}`, 'action');
        await persistAction(session, 'ACK', { userId: user.id });
        await evaluateAck(session);
        broadcast(session);
      } catch (error) {
        console.error('ACK error', error);
        sendWsError(ws, "Impossible d'acquitter.");
      }
      break;
    }
    case 'RESET': {
      try {
        const user = await requireUserForRole(message.token);
        const session = ensureSession(message.sessionId);
        session.state.awaitingReset = false;
        session.state.cmsiPhase = 'idle';
        session.state.alimentation = 'secteur';
        session.state.dasStatus = Object.fromEntries(
          Object.keys(session.state.dasStatus).map((id) => [id, 'en_position'])
        );
        session.state.t1Remaining = session.state.t1;
        session.state.t2Remaining = session.state.t2;
        session.state.activeAlarms = { dm: [], dai: [] };
        addTimeline(session, `Réarmement effectué par ${user.name}`, 'action');
        await persistAction(session, 'RESET', { userId: user.id });
        await evaluateSequence(session);
        broadcast(session);
      } catch (error) {
        console.error('RESET error', error);
        sendWsError(ws, 'Réarmement impossible.');
      }
      break;
    }
    case 'UGA_STOP': {
      try {
        const user = await requireUserForRole(message.token);
        const session = ensureSession(message.sessionId);
        session.state.ugaActive = false;
        addTimeline(session, `Arrêt UGA manuel par ${user.name}`, 'action');
        await persistAction(session, 'UGA_STOP', { userId: user.id });
        await updateScore(session, 'Arrêt UGA prématuré', -25);
        broadcast(session);
      } catch (error) {
        console.error('UGA_STOP error', error);
        sendWsError(ws, "Arrêt UGA non autorisé.");
      }
      break;
    }
    case 'SET_OUT_OF_SERVICE': {
      try {
        const user = await requireUserForRole(message.token);
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
          `${actionLabel} ${active ? 'mise hors service' : 'remise en service'} (${name}) par ${user.name}`,
          'action'
        );
        await persistAction(session, 'SET_OUT_OF_SERVICE', {
          targetType,
          targetId,
          active,
          label,
          userId: user.id
        });
        broadcast(session);
      } catch (error) {
        console.error('SET_OUT_OF_SERVICE error', error);
        sendWsError(ws, 'Action hors service refusée.');
      }
      break;
    }
    case 'STOP_SCENARIO': {
      try {
        const trainer = await requireUserForRole(message.token, 'TRAINER');
        const session = ensureSession(message.sessionId);
        resetTick(session);
        if (session.state.awaitingReset) {
          await updateScore(session, 'Absence de réarmement', -10);
        }
        session.state.awaitingReset = false;
        session.state.cmsiPhase = 'idle';
        session.state.ugaActive = false;
        session.state.activeAlarms = { dm: [], dai: [] };
        addTimeline(session, `Scénario arrêté par ${trainer.name}`, 'system');
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
      } catch (error) {
        console.error('STOP_SCENARIO error', error);
        sendWsError(ws, 'Arrêt de scénario refusé.');
      }
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
