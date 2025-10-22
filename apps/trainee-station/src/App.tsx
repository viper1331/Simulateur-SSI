import { useEffect, useMemo } from 'react';
import { useSessionStore } from './store';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { cmsiMachine } from '@ssi/state-machines';
import { useMachine } from '@xstate/react';
import type { Scenario } from '@ssi/shared-models';
import { initialScoreRules } from '@ssi/shared-models';

const Buzzer = ({ active }: { active: boolean }) => {
  useEffect(() => {
    if (!active) return;
    const AudioCtx = (typeof window !== 'undefined' && (window as any).AudioContext) || undefined;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 440;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    return () => {
      oscillator.stop();
      context.close();
    };
  }, [active]);
  return null;
};

const TemporisationBar = ({ label, value, max }: { label: string; value?: number; max?: number }) => {
  const percentage = value !== undefined && max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{value ?? '--'} s</span>
      </div>
      <div className="mt-1 h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-indigo-500 transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const Timeline = () => {
  const timeline = useSessionStore((state) => state.session?.timeline ?? []);
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm">
      {timeline.length === 0 && <p className="text-slate-500">En attente d'événements...</p>}
      {timeline.map((item) => (
        <div key={item.id} className="border-b border-slate-100 py-2 last:border-0">
          <div className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
          <div className="font-medium text-slate-700">{item.message}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{item.category}</div>
        </div>
      ))}
    </div>
  );
};

const Synoptic = ({ scenario }: { scenario?: Scenario }) => {
  const dasStatus = useSessionStore((state) => state.session?.dasStatus ?? {});
  if (!scenario) {
    return (
      <Card title="Synoptique">
        <p className="text-sm text-slate-500">Aucun scénario actif.</p>
      </Card>
    );
  }

  return (
    <Card title="Synoptique zones / DAS">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Zones de détection</h4>
          <ul className="space-y-1">
            {scenario.zd.map((zone: Scenario['zd'][number]) => (
              <li key={zone.id} className="rounded bg-slate-100 px-2 py-1">
                <span className="font-semibold">{zone.name}</span>
                <span className="ml-2 text-xs text-slate-500">ZD {zone.id}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">Dispositifs</h4>
          <ul className="space-y-1">
            {scenario.das.map((das: Scenario['das'][number]) => (
              <li key={das.id} className="rounded bg-slate-100 px-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{das.name}</span>
                  <span className="text-xs uppercase text-slate-500">{das.type}</span>
                </div>
                <div className="text-xs text-slate-500">
                  État : {dasStatus[das.id] ?? das.status}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};

const PeripheralPanel = ({ scenario }: { scenario?: Scenario }) => {
  const triggerEvent = useSessionStore((state) => state.triggerEvent);

  if (!scenario) {
    return null;
  }

  return (
    <Card title="Périphériques SDI">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Déclencheurs manuels</h4>
          <div className="mt-2 space-y-2">
            {scenario.zd.map((zone: Scenario['zd'][number]) => (
              <Button
                key={zone.id}
                className="w-full bg-red-100 text-red-700 hover:bg-red-200"
                onClick={() =>
                  triggerEvent({
                    id: `dm-${zone.id}`,
                    scenarioId: scenario.id,
                    timestamp: Date.now(),
                    type: 'ALARME_DM',
                    payload: { zdId: zone.id }
                  })
                }
              >
                DM {zone.name}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Détecteurs automatiques</h4>
          <div className="mt-2 space-y-2">
            {scenario.zd.map((zone: Scenario['zd'][number]) => (
              <Button
                key={`dai-${zone.id}`}
                className="w-full bg-amber-100 text-amber-700 hover:bg-amber-200"
                onClick={() =>
                  triggerEvent({
                    id: `dai-${zone.id}`,
                    scenarioId: scenario.id,
                    timestamp: Date.now(),
                    type: 'ALARME_DAI',
                    payload: { zdId: zone.id }
                  })
                }
              >
                DAI {zone.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

type SessionData = ReturnType<typeof useSessionStore.getState>['session'];

const ScenarioBriefing = ({ scenario }: { scenario?: Scenario }) => {
  if (!scenario) {
    return (
      <Card title="Briefing scénario">
        <p className="text-sm text-slate-500">En attente du lancement d'un scénario par le formateur.</p>
      </Card>
    );
  }

  const events = [...scenario.events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Card title="Briefing scénario">
      <div className="space-y-3 text-sm text-slate-600">
        <p>{scenario.description}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-600">Temporisation T1</span> : {scenario.t1} s
          </div>
          <div>
            <span className="font-semibold text-slate-600">Temporisation T2</span> : {scenario.t2} s
          </div>
          <div>
            <span className="font-semibold text-slate-600">Zones surveillées</span> : {scenario.zd.length}
          </div>
          <div>
            <span className="font-semibold text-slate-600">DAS associés</span> : {scenario.das.length}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Événements prévus</h4>
          {events.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs text-slate-600"
                >
                  <span>{event.type}</span>
                  <span>{event.timestamp} s</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Aucun événement automatique ne sera injecté.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const ActionChecklist = ({ session }: { session?: SessionData }) => {
  const awaitingReset = session?.awaitingReset ?? false;
  const ackDone = session?.timeline.some((item) => item.message.includes('Acquittement')) ?? false;
  const resetDone = session?.timeline.some((item) => item.message.includes('Réarmement')) ?? false;
  const ugaActive = session?.ugaActive ?? false;
  const dasIssue = Object.values(session?.dasStatus ?? {}).some((status) => status !== 'en_position');

  const items: Array<{ id: string; label: string; description: string; tone: 'danger' | 'warning' | 'ok' }> = [
    {
      id: 'ack',
      label: "Acquitter l'alarme",
      tone: ackDone ? 'ok' : 'warning',
      description: ackDone
        ? "Acquittement effectué, poursuivre la procédure."
        : "Appuyer sur le bouton d'acquittement dès validation du formateur."
    },
    {
      id: 'reset',
      label: 'Réarmer le CMSI',
      tone: !awaitingReset && resetDone ? 'ok' : 'warning',
      description:
        !awaitingReset && resetDone
          ? 'Le système est revenu au repos.'
          : 'Préparer le réarmement une fois la zone sécurisée.'
    },
    {
      id: 'uga',
      label: 'Arrêt UGA le cas échéant',
      tone: ugaActive ? 'danger' : 'ok',
      description: ugaActive
        ? 'UGA en diffusion : anticiper l’arrêt après l’ordre formateur.'
        : "Pas d'évacuation sonore en cours."
    },
    {
      id: 'das',
      label: 'Contrôler les DAS',
      tone: dasIssue ? 'warning' : 'ok',
      description: dasIssue ? 'Un DAS signale un défaut ou une commande en cours.' : 'Tous les DAS sont conformes.'
    }
  ];

  return (
    <Card title="Checklist apprenant">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
            <Indicator label={item.label} tone={item.tone} active />
            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const LearningObjectives = ({ score }: { score?: number }) => (
  <Card title="Objectifs pédagogiques">
    <p className="text-sm text-slate-600">Score actuel : {score ?? 0} pts</p>
    <p className="mt-1 text-xs text-slate-500">
      Respectez ces points de vigilance pour maximiser votre évaluation durant la simulation.
    </p>
    <ul className="mt-3 space-y-2 text-xs text-slate-500">
      {initialScoreRules.map((rule) => (
        <li key={rule.id} className="flex items-center justify-between rounded bg-slate-100 px-2 py-1">
          <span className="font-medium text-slate-600">{rule.label}</span>
          <span className={rule.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {rule.delta >= 0 ? `+${rule.delta}` : rule.delta} pts
          </span>
        </li>
      ))}
    </ul>
  </Card>
);

const CmsiFacade = () => {
  const connect = useSessionStore((state) => state.connect);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const session = useSessionStore((state) => state.session);
  const ack = useSessionStore((state) => state.ack);
  const reset = useSessionStore((state) => state.reset);
  const stopUGA = useSessionStore((state) => state.stopUGA);
  const scenarios = useSessionStore((state) => state.scenarios);

  useEffect(() => {
    connect();
  }, [connect]);

  const scenario = useMemo(() => {
    const scenarioId = session?.scenarioId;
    if (!scenarioId) return undefined;
    return scenarios.find((scn) => scn.id === scenarioId);
  }, [scenarios, session?.scenarioId]);

  const [cmsiSnapshot, sendCmsi] = useMachine(cmsiMachine, { input: undefined });

  useEffect(() => {
    if (session?.cmsiPhase && session.t1 && session.t2) {
      if (session.cmsiPhase === 'preAlerte') {
        sendCmsi({ type: 'TRIGGER_PREALERTE', t1: session.t1, t2: session.t2 } as any);
      }
      if (session.cmsiPhase === 'alerte' || session.cmsiPhase === 'ugaActive') {
        sendCmsi({ type: 'TICK' } as any);
      }
      if (session.cmsiPhase === 'retourNormal') {
        sendCmsi({ type: 'ACK' } as any);
      }
      if (session.cmsiPhase === 'idle') {
        sendCmsi({ type: 'RESET' } as any);
      }
    }
  }, [session?.cmsiPhase, session?.t1, session?.t2, sendCmsi]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card title="Statut CMSI">
        <div className="space-y-2">
          <Indicator label="Alarme feu" active={session?.cmsiPhase === 'preAlerte' || session?.cmsiPhase === 'alerte'} tone="danger" />
          <Indicator label="UGA active" active={session?.ugaActive ?? false} tone="danger" />
          <Indicator label="Défaut alimentation" active={session?.alimentation !== 'secteur'} tone="warning" />
          <Indicator label="DAS" active={Object.values(session?.dasStatus ?? {}).some((status) => status !== 'en_position')} tone="warning" />
          <Indicator label="Hors service" active={session?.awaitingReset ?? false} tone="warning" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={ack} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
            Acquitter
          </Button>
          <Button onClick={reset} className="bg-sky-100 text-sky-700 hover:bg-sky-200">
            Réarmement
          </Button>
          <Button onClick={stopUGA} className="bg-amber-100 text-amber-700 hover:bg-amber-200">
            Arrêt évacuation
          </Button>
          <Button className="bg-slate-200 text-slate-700" onClick={() => alert('Test lampes enclenché')}>
            Test lampes
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          <TemporisationBar label="Temporisation T1" value={session?.t1Remaining} max={session?.t1} />
          <TemporisationBar label="Temporisation T2" value={session?.t2Remaining} max={session?.t2} />
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Connexion : {connectionStatus}
        </div>
        <div className="mt-2 text-xs text-slate-500">État machine CMSI : {String(cmsiSnapshot.value)}</div>
      </Card>
      <div className="md:col-span-2 space-y-4">
        <Synoptic scenario={scenario} />
        <PeripheralPanel scenario={scenario} />
      </div>
    </div>
  );
};

const Dashboard = ({ scenario }: { scenario?: Scenario }) => {
  const session = useSessionStore((state) => state.session);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Synthèse de formation">
        <div className="space-y-2 text-sm text-slate-600">
          <div>Scénario : {scenario?.name ?? session?.scenarioId ?? 'en attente'}</div>
          <div>Phase CMSI : {session?.cmsiPhase ?? 'idle'}</div>
          <div>Score : {session?.score ?? 0} pts</div>
          <div>Temporisations : T1 {session?.t1Remaining ?? '--'} s / T2 {session?.t2Remaining ?? '--'} s</div>
        </div>
      </Card>
      <div className="lg:col-span-2 space-y-4">
        <Card title="Chronologie">
          <Timeline />
        </Card>
        <LearningObjectives score={session?.score} />
      </div>
    </div>
  );
};

const App = () => {
  const session = useSessionStore((state) => state.session);
  const scenarios = useSessionStore((state) => state.scenarios);
  const scenario = useMemo(() => {
    if (!session?.scenarioId) return undefined;
    return scenarios.find((item) => item.id === session.scenarioId);
  }, [scenarios, session?.scenarioId]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-800">Poste Apprenant CMSI</h1>
          <p className="text-slate-500">Version {__APP_VERSION__} – entraînez-vous à l'exploitation d'un SSI de catégorie A.</p>
        </header>
        <CmsiFacade />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScenarioBriefing scenario={scenario} />
          <ActionChecklist session={session} />
        </div>
        <Dashboard scenario={scenario} />
        <Buzzer active={session?.ugaActive ?? false} />
      </div>
    </div>
  );
};

export default App;
