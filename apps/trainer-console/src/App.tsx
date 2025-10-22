import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { useTrainerStore } from './store';
import type { Scenario } from '@ssi/shared-models';
import { initialScoreRules } from '@ssi/shared-models';

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return '--';
  return `${seconds.toString().padStart(2, '0')} s`;
};

const SessionChip = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-indigo-100">
    <span>{label}</span>
    <span className="ml-2 text-white">{value ?? '—'}</span>
  </div>
);

const ConnectionBadge = ({
  status
}: {
  status: 'idle' | 'connecting' | 'connected' | 'error';
}) => {
  const tone: 'danger' | 'warning' | 'ok' =
    status === 'connected' ? 'ok' : status === 'error' ? 'danger' : 'warning';

  const label =
    status === 'connected'
      ? 'Connecté'
      : status === 'error'
      ? 'Déconnecté'
      : status === 'connecting'
      ? 'Connexion…'
      : 'En attente';

  return <Indicator label={`Serveur ${label}`} tone={tone} active />;
};

const ScenarioSelector = ({
  scenarios,
  selectedScenarioId,
  onSelect
}: {
  scenarios: Scenario[];
  selectedScenarioId?: string;
  onSelect: (id: string) => void;
}) => (
  <Card title="Scénarios disponibles">
    {scenarios.length > 0 ? (
      <div className="flex flex-col gap-2">
        {scenarios.map((scenario) => {
          const isActive = scenario.id === selectedScenarioId;
          const eventsLabel = `${scenario.events.length} evt`;
          const badgeTone = isActive ? 'text-indigo-100' : 'text-slate-500';

          return (
            <Button
              key={scenario.id}
              onClick={() => onSelect(scenario.id)}
              className={`flex w-full items-start justify-between gap-3 border ${
                isActive
                  ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex-1 text-left">
                <span className="block text-sm font-semibold">{scenario.name}</span>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {scenario.description ?? 'Scénario personnalisé'}
                </span>
              </span>
              <span className={`text-xs font-semibold uppercase tracking-wide ${badgeTone}`}>{eventsLabel}</span>
            </Button>
          );
        })}
      </div>
    ) : (
      <p className="text-sm text-slate-500">Aucun scénario disponible pour le moment.</p>
    )}
  </Card>
);

const Timeline = () => {
  const timeline = useTrainerStore((state) => state.session?.timeline ?? []);
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {timeline.map((item) => (
        <div key={item.id} className="rounded border border-slate-200 bg-white p-3">
          <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">{item.category}</div>
          <div className="text-sm font-semibold text-slate-700">{item.message}</div>
          <div className="text-[0.65rem] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      {timeline.length === 0 && (
        <p className="text-sm text-slate-500">Aucun événement enregistré pour le moment.</p>
      )}
    </div>
  );
};

const ScorePanel = () => {
  const session = useTrainerStore((state) => state.session);
  const ackDelaySeconds = useMemo(() => {
    if (!session?.ackTimestamp || !session?.alarmStartedAt) return undefined;
    return Math.max(0, Math.round((session.ackTimestamp - session.alarmStartedAt) / 1000));
  }, [session?.ackTimestamp, session?.alarmStartedAt]);
  const resetPerformed = session?.timeline.some((item) => item.message.includes('Réarmement')) ?? false;
  const awaitingReset = session?.awaitingReset ?? false;
  const ugaManualStop = session?.timeline.some((item) => item.message.includes('Arrêt UGA')) ?? false;

  const ruleStatuses = initialScoreRules.map((rule) => {
    switch (rule.id) {
      case 'ack-fast': {
        const achieved = ackDelaySeconds !== undefined && ackDelaySeconds <= 15;
        return {
          id: rule.id,
          label: rule.label,
          delta: rule.delta,
          tone: achieved ? ('ok' as const) : ackDelaySeconds !== undefined ? ('warning' as const) : ('warning' as const),
          description:
            ackDelaySeconds !== undefined
              ? `Acquittement réalisé en ${ackDelaySeconds} s.`
              : "En attente d'une alarme pour mesurer le temps de réaction.",
          value: ackDelaySeconds !== undefined ? `${ackDelaySeconds} s` : undefined
        };
      }
      case 'sequence-correct': {
        const achieved = !awaitingReset && resetPerformed && (session?.cmsiPhase ?? 'idle') === 'idle';
        return {
          id: rule.id,
          label: rule.label,
          delta: rule.delta,
          tone: achieved ? ('ok' as const) : ('warning' as const),
          description: achieved
            ? 'Séquence complète : acquittement et réarmement validés.'
            : 'Le scénario attend encore un retour au repos complet.',
          value: achieved ? 'Validé' : 'À confirmer'
        };
      }
      case 'uga-stop-early': {
        return {
          id: rule.id,
          label: rule.label,
          delta: rule.delta,
          tone: ugaManualStop ? ('danger' as const) : ('ok' as const),
          description: ugaManualStop
            ? 'Arrêt manuel détecté : vérifier que l’ordre venait du formateur.'
            : "Aucun arrêt UGA non planifié n'a été détecté.",
          value: ugaManualStop ? 'Déclenché' : 'RAS'
        };
      }
      case 'no-reset': {
        return {
          id: rule.id,
          label: rule.label,
          delta: rule.delta,
          tone: awaitingReset ? ('warning' as const) : ('ok' as const),
          description: awaitingReset
            ? 'Un réarmement est attendu avant la clôture du scénario.'
            : 'Réarmement effectué avant arrêt du scénario.',
          value: awaitingReset ? 'Action requise' : 'Conforme'
        };
      }
      default:
        return {
          id: rule.id,
          label: rule.label,
          delta: rule.delta,
          tone: 'ok' as const,
          description: 'Suivi non défini pour cette règle.',
          value: undefined
        };
    }
  });

  return (
    <Card title="Scoring">
      <div className="space-y-2 text-sm text-slate-600">
        <div>Score courant : {session?.score ?? 0} pts</div>
        <div>Phase CMSI : {session?.cmsiPhase ?? 'idle'}</div>
        <div>Temporisation T1 restante : {formatDuration(session?.t1Remaining)}</div>
        <div>Temporisation T2 restante : {formatDuration(session?.t2Remaining)}</div>
      </div>
      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase text-slate-500">Règles d'évaluation</h4>
        <ul className="mt-2 space-y-2">
          {ruleStatuses.map((status) => (
            <li key={status.id} className="rounded border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{status.label}</span>
                <span className={`text-xs font-semibold ${status.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {status.delta >= 0 ? `+${status.delta}` : status.delta} pts
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Indicator
                  label={status.value ?? (status.tone === 'ok' ? 'OK' : status.tone === 'warning' ? 'À surveiller' : 'Attention')}
                  tone={status.tone}
                  active
                />
                <span className="text-xs text-slate-500">{status.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};

const SessionOverview = ({ scenario }: { scenario?: Scenario }) => {
  const { session, sessionId, trainerId, traineeId, connectionStatus } = useTrainerStore((state) => ({
    session: state.session,
    sessionId: state.sessionId,
    trainerId: state.trainerId,
    traineeId: state.traineeId,
    connectionStatus: state.connectionStatus
  }));

  const connectionTone: 'danger' | 'warning' | 'ok' =
    connectionStatus === 'connected' ? 'ok' : connectionStatus === 'error' ? 'danger' : 'warning';

  return (
    <Card title="Session en cours">
      <div className="space-y-1 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">Identifiant</span>
          <span>{session?.id ?? sessionId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">Formateur</span>
          <span>{trainerId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">Apprenant</span>
          <span>{traineeId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">Scénario</span>
          <span>{scenario?.name ?? 'En attente'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-600">Run</span>
          <span>{session?.runId ?? 'Non démarré'}</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Indicator label={`Connexion ${connectionStatus}`} active tone={connectionTone} />
        <Indicator label="Réarmement requis" active={session?.awaitingReset ?? false} tone="warning" />
        <Indicator label="UGA active" active={session?.ugaActive ?? false} tone="danger" />
      </div>
    </Card>
  );
};

const TraineeMonitoring = () => {
  const session = useTrainerStore((state) => state.session);
  const dasIssues = Object.values(session?.dasStatus ?? {}).some((status) => status !== 'en_position');
  const ackDone = session?.timeline.some((item) => item.message.includes('Acquittement')) ?? false;
  const resetDone = session?.timeline.some((item) => item.message.includes('Réarmement')) ?? false;

  const statuses: Array<{ id: string; label: string; tone: 'danger' | 'warning' | 'ok'; description: string }> = [
    {
      id: 'ack',
      label: 'Acquittement effectué',
      tone: ackDone ? 'ok' : 'warning',
      description: ackDone
        ? "Le CMSI a été acquitté par l'apprenant."
        : "En attente de l'action d'acquittement sur la façade."
    },
    {
      id: 'reset',
      label: 'Réarmement réalisé',
      tone: !session?.awaitingReset && resetDone ? 'ok' : 'warning',
      description:
        !session?.awaitingReset && resetDone
          ? 'Le système est revenu au repos.'
          : 'Prévoir un réarmement une fois l’ordre donné.'
    },
    {
      id: 'das',
      label: 'DAS opérationnels',
      tone: dasIssues ? 'warning' : 'ok',
      description: dasIssues ? 'Des dispositifs signalent un défaut.' : 'Tous les DAS sont en position.'
    },
    {
      id: 'uga',
      label: session?.ugaActive ? 'UGA en cours' : 'UGA arrêtée',
      tone: session?.ugaActive ? 'danger' : 'ok',
      description: session?.ugaActive
        ? "L'évacuation sonore est active : suivre la progression."
        : "Aucune diffusion sonore en cours."
    }
  ];

  return (
    <Card title="Suivi apprenant">
      <ul className="space-y-3">
        {statuses.map((status) => (
          <li key={status.id} className="rounded border border-slate-200 bg-slate-50 p-2">
            <Indicator label={status.label} tone={status.tone} active />
            <p className="mt-1 text-xs text-slate-500">{status.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const ScenarioDetails = ({ scenario }: { scenario?: Scenario }) => {
  if (!scenario) {
    return (
      <Card title="Briefing scénario">
        <p className="text-sm text-slate-500">Sélectionnez un scénario pour consulter ses informations.</p>
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
            <span className="font-semibold text-slate-600">Zones de détection</span> : {scenario.zd.length}
          </div>
          <div>
            <span className="font-semibold text-slate-600">DAS pilotés</span> : {scenario.das.length}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Événements planifiés</h4>
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
            <p className="mt-2 text-xs text-slate-500">Aucun événement préprogrammé pour ce scénario.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const TrainerControls = ({ scenario }: { scenario?: Scenario }) => {
  const triggerEvent = useTrainerStore((state) => state.triggerEvent);
  const stopScenario = useTrainerStore((state) => state.stopScenario);
  const session = useTrainerStore((state) => state.session);

  const scenarioId = scenario?.id ?? 'unknown';
  const hasActiveScenario = Boolean(scenario);
  const hasActiveSession = Boolean(session);

  return (
    <Card title="Commandes formateur">
      <p className="mb-3 text-xs text-slate-500">
        Déclenchez des événements pour rythmer la session ou terminez le scénario en cours.
      </p>
      <div className="space-y-2">
        <Button
          onClick={() =>
            triggerEvent({ id: 'trainer-dm', scenarioId, timestamp: Date.now(), type: 'ALARME_DM', payload: {} })
          }
          disabled={!hasActiveScenario}
          className="w-full bg-red-100 text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Injecter alarme DM
        </Button>
        <Button
          onClick={() =>
            triggerEvent({ id: 'trainer-dai', scenarioId, timestamp: Date.now(), type: 'ALARME_DAI', payload: {} })
          }
          disabled={!hasActiveScenario}
          className="w-full bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Injecter alarme DAI
        </Button>
        <Button
          onClick={() =>
            triggerEvent({
              id: 'trainer-das',
              scenarioId,
              timestamp: Date.now(),
              type: 'DAS_BLOQUE',
              payload: { dasId: scenario?.das[0]?.id }
            })
          }
          disabled={!hasActiveScenario}
          className="w-full bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Bloquer un DAS
        </Button>
        <Button
          onClick={() =>
            triggerEvent({ id: 'trainer-secteur', scenarioId, timestamp: Date.now(), type: 'COUPURE_SECTEUR', payload: {} })
          }
          disabled={!hasActiveScenario}
          className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Simuler coupure secteur
        </Button>
        <Button
          onClick={stopScenario}
          disabled={!hasActiveSession}
          className="w-full bg-slate-900 text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Arrêter le scénario
        </Button>
      </div>
    </Card>
  );
};

const ScenarioEditor = ({ scenario, onUpdate }: { scenario?: Scenario; onUpdate: (updated: Scenario) => void }) => {
  const [t1, setT1] = useState(scenario?.t1 ?? 15);
  const [t2, setT2] = useState(scenario?.t2 ?? 5);

  useEffect(() => {
    if (scenario) {
      setT1(scenario.t1);
      setT2(scenario.t2);
    }
  }, [scenario]);

  return (
    <Card title="Paramètres de scénario">
      {scenario ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Temporisation T1</label>
            <input
              type="number"
              min={5}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={t1}
              onChange={(event) => {
                const newValue = Number(event.target.value);
                setT1(newValue);
                onUpdate({ ...scenario, t1: newValue });
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Temporisation T2</label>
            <input
              type="number"
              min={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={t2}
              onChange={(event) => {
                const newValue = Number(event.target.value);
                setT2(newValue);
                onUpdate({ ...scenario, t2: newValue });
              }}
            />
          </div>
          <p className="text-xs text-slate-500">
            La console met automatiquement à jour la logique d'asservissement ZD → ZF → DAS.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sélectionnez un scénario pour l'éditer.</p>
      )}
    </Card>
  );
};

const App = () => {
  const { connect, startScenario, scenarios, session, sessionId, trainerId, traineeId, connectionStatus } =
    useTrainerStore((state) => ({
      connect: state.connect,
      startScenario: state.startScenario,
      scenarios: state.scenarios,
      session: state.session,
      sessionId: state.sessionId,
      trainerId: state.trainerId,
      traineeId: state.traineeId,
      connectionStatus: state.connectionStatus
    }));

  const scenario = useMemo(
    () => scenarios.find((item) => item.id === session?.scenarioId),
    [scenarios, session?.scenarioId]
  );

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">Simulation SSI</p>
              <h1 className="mt-2 text-3xl font-semibold">Console Formateur SSI</h1>
              <p className="mt-3 max-w-xl text-sm text-indigo-100">
                Pilotez les événements du scénario, suivez l'apprenant et gardez le scoring sous contrôle en un coup d'œil.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <ConnectionBadge status={connectionStatus} />
              <div className="flex flex-wrap items-center gap-2">
                <SessionChip label="Session" value={session?.id ?? sessionId} />
                <SessionChip label="Run" value={session?.runId ?? '—'} />
                <SessionChip label="Formateur" value={trainerId} />
                <SessionChip label="Apprenant" value={traineeId} />
                <SessionChip label="Scénario" value={scenario?.name ?? 'En attente'} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-4">
            <ScenarioSelector
              scenarios={scenarios}
              selectedScenarioId={scenario?.id ?? session?.scenarioId}
              onSelect={startScenario}
            />
            <SessionOverview scenario={scenario} />
            <ScorePanel />
            <TraineeMonitoring />
            <TrainerControls scenario={scenario} />
          </aside>

          <main className="space-y-4">
            <Card title="Timeline">
              <Timeline />
            </Card>
            <ScenarioDetails scenario={scenario} />
            <Card title="Supervision des zones">
              {scenario ? (
                <div className="grid gap-4 text-sm lg:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-slate-500">Zones de détection</h4>
                    <ul className="mt-2 space-y-1">
                      {scenario.zd.map((zone) => (
                        <li
                          key={zone.id}
                          className="flex items-center justify-between rounded bg-slate-100 px-3 py-2"
                        >
                          <span>{zone.name}</span>
                          <Indicator label={`ZD ${zone.id}`} active />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-slate-500">DAS</h4>
                    <ul className="mt-2 space-y-1">
                      {scenario.das.map((das) => {
                        const status = session?.dasStatus?.[das.id] ?? das.status;
                        const active = status !== 'en_position';
                        return (
                          <li
                            key={das.id}
                            className="flex items-center justify-between rounded bg-slate-100 px-3 py-2"
                          >
                            <span>{das.name}</span>
                            <Indicator label={status} active={active} tone={active ? 'warning' : 'ok'} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun scénario actif.</p>
              )}
            </Card>
            <ScenarioEditor
              scenario={scenario}
              onUpdate={(updated) => {
                console.log('Scenario updated (client-side)', updated);
              }}
            />
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
