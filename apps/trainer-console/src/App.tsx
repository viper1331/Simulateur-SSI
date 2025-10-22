import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { useTrainerStore } from './store';
import type { Scenario, ScenarioEvent } from '@ssi/shared-models';
import { initialScoreRules } from '@ssi/shared-models';

type ActiveAlarms = { dm: string[]; dai: string[] };

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const cloneScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  zd: scenario.zd.map((zone) => ({ ...zone, linkedZoneIds: [...zone.linkedZoneIds] })),
  zf: scenario.zf.map((zone) => ({ ...zone, dasIds: [...zone.dasIds] })),
  das: scenario.das.map((das) => ({ ...das })),
  peripherals: (scenario.peripherals ?? []).map((peripheral) => ({ ...peripheral })),
  events: scenario.events.map((event) => ({ ...event, payload: { ...event.payload } }))
});

const synchronizeZfWithDas = (dasList: Scenario['das'], zfList: Scenario['zf']): Scenario['zf'] => {
  const assignments = new Map<string, string[]>();
  zfList.forEach((zone) => assignments.set(zone.id, []));
  dasList.forEach((device) => {
    const list = assignments.get(device.zoneId);
    if (list) {
      list.push(device.id);
    }
  });
  return zfList.map((zone) => ({ ...zone, dasIds: assignments.get(zone.id) ?? [] }));
};

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

const VisualAlarmLamp = ({
  label,
  colorClass,
  items,
  emptyLabel
}: {
  label: string;
  colorClass: string;
  items: string[];
  emptyLabel: string;
}) => (
  <div className="rounded border border-slate-200 bg-white/80 p-2">
    <div className="flex items-center gap-2">
      <span
        className={`h-4 w-4 rounded-full border border-slate-300 transition-all ${
          items.length > 0 ? colorClass : 'bg-slate-200'
        }`}
      />
      <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-600">{label}</span>
      {items.length > 0 && (
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[0.6rem] font-semibold text-slate-500">
          {items.length}
        </span>
      )}
    </div>
    {items.length > 0 ? (
      <ul className="mt-2 space-y-1 text-[0.65rem] text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-[0.65rem] text-slate-500">{emptyLabel}</p>
    )}
  </div>
);

const VisualAlarmPanel = ({ scenario, activeAlarms }: { scenario?: Scenario; activeAlarms: ActiveAlarms }) => {
  const zoneNameById = useMemo(() => {
    const entries = new Map<string, string>();
    (scenario?.zd ?? []).forEach((zone) => entries.set(zone.id, zone.name));
    return entries;
  }, [scenario]);

  const resolveLabel = (zoneId: string) => zoneNameById.get(zoneId) ?? zoneId.toUpperCase();
  const dmItems = activeAlarms.dm.map(resolveLabel);
  const daiItems = activeAlarms.dai.map(resolveLabel);

  return (
    <div className="mt-2 space-y-2">
      <VisualAlarmLamp
        label="DM en alarme"
        colorClass="bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.55)] animate-pulse"
        items={dmItems}
        emptyLabel="Aucun DM déclenché."
      />
      <VisualAlarmLamp
        label="DAI en alarme"
        colorClass="bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)] animate-pulse"
        items={daiItems}
        emptyLabel="Aucun DAI déclenché."
      />
    </div>
  );
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
  const activeAlarms = session?.activeAlarms ?? { dm: [], dai: [] };

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
      <div className="mt-4">
        <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500">Alarmes visuelles</h4>
        <VisualAlarmPanel scenario={scenario} activeAlarms={activeAlarms} />
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
          <div>
            <span className="font-semibold text-slate-600">Périphériques</span> : {scenario.peripherals.length}
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
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Détection configurée</h4>
          {scenario.peripherals.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {scenario.peripherals.map((peripheral) => {
                const zoneLabel = scenario.zd.find((zone) => zone.id === peripheral.zoneId)?.name ?? peripheral.zoneId;
                const typeLabel = peripheral.type.replace(/_/g, ' ').toUpperCase();
                return (
                  <li key={peripheral.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1">
                    <span className="text-xs font-semibold text-slate-600">{peripheral.name}</span>
                    <span className="text-[0.7rem] uppercase tracking-wide text-slate-500">
                      {typeLabel} · {zoneLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Ajoutez des DM, DAI ou capteurs pour enrichir le scénario.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

const AccessManagementPanel = () => {
  const { session, setAccessLevel } = useTrainerStore((state) => ({
    session: state.session,
    setAccessLevel: state.setAccessLevel
  }));
  const currentLevel = session?.accessLevel ?? 0;
  const [feedback, setFeedback] = useState<string | undefined>();
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'warning'>('warning');
  const quickLevels = [1, 2, 3] as const;

  const handleActivate = (level: Exclude<AccessLevel, 0>) => {
    setAccessLevel(level);
    setFeedback(`Niveau ${ACCESS_LEVELS[level].label} activé`);
    setFeedbackTone('ok');
  };

  const handleLock = () => {
    setAccessLevel(0);
    setFeedback('Accès SSI verrouillé');
    setFeedbackTone('warning');
  };

  return (
    <Card title="Gestion des accès SSI">
      <div className="space-y-3 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Niveau actif</span>
          <Indicator
            label={ACCESS_LEVELS[currentLevel].label}
            tone={currentLevel === 0 ? 'warning' : 'ok'}
            active
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quickLevels.map((level) => (
            <Button
              key={level}
              onClick={() => handleActivate(level)}
              disabled={currentLevel === level}
              className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Activer {ACCESS_LEVELS[level].label}
            </Button>
          ))}
        </div>
        <Button onClick={handleLock} className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300">
          Verrouiller l'accès
        </Button>
        {feedback && <Indicator label={feedback} tone={feedbackTone} active />}
        <div>
          <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500">Codes disponibles</h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {ACCESS_CODES.map((item) => (
              <li key={item.level} className="flex items-center justify-between rounded bg-slate-100 px-2 py-1">
                <span className="font-semibold text-slate-600">{item.label}</span>
                <span className="font-mono">{item.code}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500">Droits associés</h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {quickLevels.map((level) => (
              <li
                key={`rights-${level}`}
                className={level === currentLevel ? 'text-xs font-semibold text-slate-600' : undefined}
              >
                <span className="text-slate-600">{ACCESS_LEVELS[level].label}</span>
                {': '}
                {ACCESS_LEVELS[level].rights.join(', ')}
                {level === currentLevel && <span className="ml-1 text-indigo-600">(actif)</span>}
              </li>
            ))}
          </ul>
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
  const [draft, setDraft] = useState<Scenario | undefined>(scenario ? cloneScenario(scenario) : undefined);

  useEffect(() => {
    setDraft(scenario ? cloneScenario(scenario) : undefined);
  }, [scenario]);

  if (!scenario || !draft) {
    return (
      <Card title="Paramètres de scénario">
        <p className="text-sm text-slate-500">Sélectionnez un scénario pour l'éditer.</p>
      </Card>
    );
  }

  const readPayloadString = (payload: Record<string, unknown>, key: string) => {
    const value = payload?.[key];
    return typeof value === 'string' ? (value as string) : undefined;
  };

  const handleDraftUpdate = (next: Scenario) => {
    const synchronized = {
      ...next,
      zf: synchronizeZfWithDas(next.das, next.zf)
    };
    setDraft(cloneScenario(synchronized));
    onUpdate(synchronized);
  };

  const updateScenarioValues = (updates: Partial<Scenario>) => {
    handleDraftUpdate({ ...draft, ...updates });
  };

  const addZone = () => {
    const newZone = { id: createId('zd'), name: 'Nouvelle zone', description: '', linkedZoneIds: [] as string[] };
    handleDraftUpdate({ ...draft, zd: [...draft.zd, newZone] });
  };

  const removeZone = (zoneId: string) => {
    const removedPeripheralIds = new Set(
      draft.peripherals.filter((peripheral) => peripheral.zoneId === zoneId).map((peripheral) => peripheral.id)
    );
    const filteredEvents = draft.events.filter((event) => {
      const zonePayload = readPayloadString(event.payload, 'zdId');
      const peripheralPayload = readPayloadString(event.payload, 'peripheralId');
      if (zonePayload && zonePayload === zoneId) return false;
      if (peripheralPayload && removedPeripheralIds.has(peripheralPayload)) return false;
      return true;
    });
    handleDraftUpdate({
      ...draft,
      zd: draft.zd.filter((zone) => zone.id !== zoneId),
      peripherals: draft.peripherals.filter((peripheral) => peripheral.zoneId !== zoneId),
      events: filteredEvents
    });
  };

  const updateZone = (zoneId: string, updates: Partial<(typeof draft.zd)[number]>) => {
    handleDraftUpdate({
      ...draft,
      zd: draft.zd.map((zone) => (zone.id === zoneId ? { ...zone, ...updates } : zone))
    });
  };

  const toggleLinkedZone = (zoneId: string, linkedId: string) => {
    const zone = draft.zd.find((item) => item.id === zoneId);
    if (!zone) return;
    const links = new Set(zone.linkedZoneIds);
    if (links.has(linkedId)) {
      links.delete(linkedId);
    } else {
      links.add(linkedId);
    }
    updateZone(zoneId, { linkedZoneIds: Array.from(links) });
  };

  const addZf = () => {
    const newZf = { id: createId('zf'), name: 'Nouvelle zone mise en sécurité', dasIds: [] as string[], ugaChannel: '' };
    handleDraftUpdate({ ...draft, zf: [...draft.zf, newZf] });
  };

  const removeZf = (zfId: string) => {
    const filteredDas = draft.das.filter((das) => das.zoneId !== zfId);
    const removedDasIds = new Set(draft.das.filter((das) => das.zoneId === zfId).map((das) => das.id));
    const filteredEvents = draft.events.filter((event) => {
      const targetDas = readPayloadString(event.payload, 'dasId');
      if (targetDas && removedDasIds.has(targetDas)) return false;
      return true;
    });
    handleDraftUpdate({
      ...draft,
      zf: draft.zf.filter((zone) => zone.id !== zfId),
      zd: draft.zd.map((zone) => ({
        ...zone,
        linkedZoneIds: zone.linkedZoneIds.filter((linkId) => linkId !== zfId)
      })),
      das: filteredDas,
      events: filteredEvents
    });
  };

  const updateZf = (zfId: string, updates: Partial<(typeof draft.zf)[number]>) => {
    handleDraftUpdate({
      ...draft,
      zf: draft.zf.map((zone) => (zone.id === zfId ? { ...zone, ...updates } : zone))
    });
  };

  const addDas = () => {
    const targetZone = draft.zf[0]?.id ?? '';
    const newDas = {
      id: createId('das'),
      name: 'Nouveau DAS',
      type: 'compartimentage' as (typeof draft.das)[number]['type'],
      zoneId: targetZone,
      status: 'en_position' as (typeof draft.das)[number]['status']
    };
    handleDraftUpdate({ ...draft, das: [...draft.das, newDas] });
  };

  const removeDas = (dasId: string) => {
    const filteredDas = draft.das.filter((das) => das.id !== dasId);
    const filteredEvents = draft.events.filter((event) => {
      const targetDas = readPayloadString(event.payload, 'dasId');
      if (targetDas && targetDas === dasId) return false;
      return true;
    });
    handleDraftUpdate({
      ...draft,
      das: filteredDas,
      events: filteredEvents
    });
  };

  const updateDas = (dasId: string, updates: Partial<(typeof draft.das)[number]>) => {
    const updatedDas = draft.das.map((das) => (das.id === dasId ? { ...das, ...updates } : das));
    handleDraftUpdate({
      ...draft,
      das: updatedDas
    });
  };

  const addPeripheral = () => {
    const targetZone = draft.zd[0]?.id ?? '';
    const newPeripheral = {
      id: createId('periph'),
      name: 'Nouveau périphérique',
      type: 'dm' as (typeof draft.peripherals)[number]['type'],
      zoneId: targetZone,
      description: ''
    };
    handleDraftUpdate({ ...draft, peripherals: [...draft.peripherals, newPeripheral] });
  };

  const removePeripheral = (peripheralId: string) => {
    const filteredEvents = draft.events.filter((event) => {
      const targetPeripheral = readPayloadString(event.payload, 'peripheralId');
      if (targetPeripheral && targetPeripheral === peripheralId) return false;
      return true;
    });
    handleDraftUpdate({
      ...draft,
      peripherals: draft.peripherals.filter((peripheral) => peripheral.id !== peripheralId),
      events: filteredEvents
    });
  };

  const updatePeripheral = (peripheralId: string, updates: Partial<(typeof draft.peripherals)[number]>) => {
    handleDraftUpdate({
      ...draft,
      peripherals: draft.peripherals.map((peripheral) => (peripheral.id === peripheralId ? { ...peripheral, ...updates } : peripheral))
    });
  };

  const addEvent = () => {
    const newEvent: ScenarioEvent = {
      id: createId('event'),
      scenarioId: draft.id,
      timestamp: Math.max(0, ...draft.events.map((event) => event.timestamp)) + 5,
      type: 'ALARME_DM',
      payload: {}
    };
    handleDraftUpdate({ ...draft, events: [...draft.events, newEvent] });
  };

  const removeEvent = (eventId: string) => {
    handleDraftUpdate({ ...draft, events: draft.events.filter((event) => event.id !== eventId) });
  };

  const updateEvent = (eventId: string, updates: Partial<ScenarioEvent>) => {
    handleDraftUpdate({
      ...draft,
      events: draft.events.map((event) => (event.id === eventId ? { ...event, ...updates } : event))
    });
  };

  const updateEventPayload = (
    eventId: string,
    updater: (payload: Record<string, unknown>) => Record<string, unknown>
  ) => {
    const current = draft.events.find((event) => event.id === eventId);
    if (!current) return;
    const nextPayload = updater(current.payload ?? {});
    handleDraftUpdate({
      ...draft,
      events: draft.events.map((event) => (event.id === eventId ? { ...event, payload: nextPayload } : event))
    });
  };

  const dmPeripherals = draft.peripherals.filter((peripheral) => peripheral.type === 'dm');
  const daiPeripherals = draft.peripherals.filter((peripheral) =>
    ['dai', 'detecteur_fumee', 'detecteur_chaleur'].includes(peripheral.type)
  );

  return (
    <Card title="Paramètres de scénario">
      <div className="space-y-6 text-sm text-slate-600">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-slate-500">Temporisation T1</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={draft.t1}
              onChange={(event) => updateScenarioValues({ t1: Number(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-slate-500">Temporisation T2</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={draft.t2}
              onChange={(event) => updateScenarioValues({ t2: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Zones de détection</h4>
            <Button type="button" onClick={addZone} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter une zone
            </Button>
          </div>
          {draft.zd.length === 0 && <p className="text-xs text-slate-500">Aucune zone configurée.</p>}
          <div className="space-y-3">
            {draft.zd.map((zone) => (
              <div key={zone.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase">{zone.name}</span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{zone.id}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeZone(zone.id)}
                    className="self-start bg-rose-100 text-rose-700 hover:bg-rose-200"
                  >
                    Supprimer
                  </Button>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Nom affiché</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={zone.name}
                    onChange={(event) => updateZone(zone.id, { name: event.target.value })}
                  />
                </label>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Description</span>
                  <textarea
                    className="min-h-[80px] w-full rounded border border-slate-300 px-3 py-2"
                    value={zone.description ?? ''}
                    onChange={(event) => updateZone(zone.id, { description: event.target.value })}
                  />
                </label>
                <div className="mt-3">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Zones de mise en sécurité associées
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.zf.map((zf) => {
                      const checked = zone.linkedZoneIds.includes(zf.id);
                      return (
                        <label key={`${zone.id}-${zf.id}`} className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleLinkedZone(zone.id, zf.id)}
                          />
                          <span className="text-xs text-slate-600">{zf.name}</span>
                        </label>
                      );
                    })}
                    {draft.zf.length === 0 && <span className="text-xs text-slate-400">Aucune ZF disponible</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Zones de mise en sécurité (ZF)</h4>
            <Button type="button" onClick={addZf} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter une ZF
            </Button>
          </div>
          {draft.zf.length === 0 && <p className="text-xs text-slate-500">Aucune ZF configurée.</p>}
          <div className="space-y-3">
            {draft.zf.map((zf) => (
              <div key={zf.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase">{zf.name}</span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{zf.id}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeZf(zf.id)}
                    className="self-start bg-rose-100 text-rose-700 hover:bg-rose-200"
                  >
                    Supprimer
                  </Button>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Nom affiché</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={zf.name}
                    onChange={(event) => updateZf(zf.id, { name: event.target.value })}
                  />
                </label>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Canal UGA (optionnel)</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={zf.ugaChannel ?? ''}
                    onChange={(event) => updateZf(zf.id, { ugaChannel: event.target.value || undefined })}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Dispositifs actionnés de sécurité (DAS)</h4>
            <Button type="button" onClick={addDas} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter un DAS
            </Button>
          </div>
          {draft.das.length === 0 && <p className="text-xs text-slate-500">Aucun DAS configuré.</p>}
          <div className="space-y-3">
            {draft.das.map((das) => (
              <div key={das.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase">{das.name}</span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{das.id}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeDas(das.id)}
                    className="self-start bg-rose-100 text-rose-700 hover:bg-rose-200"
                  >
                    Supprimer
                  </Button>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Nom affiché</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={das.name}
                    onChange={(event) => updateDas(das.id, { name: event.target.value })}
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={das.type}
                      onChange={(event) =>
                        updateDas(das.id, {
                          type: event.target.value as (typeof draft.das)[number]['type']
                        })
                      }
                    >
                      <option value="compartimentage">Compartimentage</option>
                      <option value="desenfumage">Désenfumage</option>
                      <option value="ventilation">Ventilation</option>
                      <option value="evacuation">Évacuation</option>
                      <option value="technique">Technique</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">Statut initial</span>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={das.status}
                      onChange={(event) =>
                        updateDas(das.id, {
                          status: event.target.value as (typeof draft.das)[number]['status']
                        })
                      }
                    >
                      <option value="en_position">En position</option>
                      <option value="commande">Commandé</option>
                      <option value="defaut">Défaut</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Zone de mise en sécurité associée</span>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={das.zoneId}
                    onChange={(event) => updateDas(das.id, { zoneId: event.target.value })}
                  >
                    <option value="">Non assigné</option>
                    {draft.zf.map((zf) => (
                      <option key={zf.id} value={zf.id}>
                        {zf.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Détection (DM, DAI, capteurs)</h4>
            <Button type="button" onClick={addPeripheral} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter un périphérique
            </Button>
          </div>
          {draft.peripherals.length === 0 && <p className="text-xs text-slate-500">Aucun périphérique configuré.</p>}
          <div className="space-y-3">
            {draft.peripherals.map((peripheral) => (
              <div key={peripheral.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold uppercase">{peripheral.name}</span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{peripheral.id}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => removePeripheral(peripheral.id)}
                    className="self-start bg-rose-100 text-rose-700 hover:bg-rose-200"
                  >
                    Supprimer
                  </Button>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Nom affiché</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    value={peripheral.name}
                    onChange={(event) => updatePeripheral(peripheral.id, { name: event.target.value })}
                  />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={peripheral.type}
                      onChange={(event) =>
                        updatePeripheral(peripheral.id, {
                          type: event.target.value as (typeof draft.peripherals)[number]['type']
                        })
                      }
                    >
                      <option value="dm">Déclencheur manuel</option>
                      <option value="dai">Détecteur automatique</option>
                      <option value="detecteur_fumee">Détecteur de fumée</option>
                      <option value="detecteur_chaleur">Détecteur de chaleur</option>
                      <option value="autre">Autre capteur</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">Zone de détection</span>
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      value={peripheral.zoneId}
                      onChange={(event) => updatePeripheral(peripheral.id, { zoneId: event.target.value })}
                    >
                      <option value="">Non assigné</option>
                      {draft.zd.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Description (optionnelle)</span>
                  <textarea
                    className="min-h-[60px] w-full rounded border border-slate-300 px-3 py-2"
                    value={peripheral.description ?? ''}
                    onChange={(event) => updatePeripheral(peripheral.id, { description: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-500">Événements planifiés</h4>
            <Button type="button" onClick={addEvent} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Ajouter un événement
            </Button>
          </div>
          {draft.events.length === 0 && <p className="text-xs text-slate-500">Aucun événement programmé.</p>}
          <div className="space-y-3">
            {draft.events
              .slice()
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((event) => {
                const payloadZoneId = readPayloadString(event.payload, 'zdId');
                const payloadPeripheralId = readPayloadString(event.payload, 'peripheralId');
                const payloadDasId = readPayloadString(event.payload, 'dasId');
                return (
                  <div key={event.id} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold uppercase">{event.type}</span>
                        <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-600">{event.id}</span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => removeEvent(event.id)}
                        className="self-start bg-rose-100 text-rose-700 hover:bg-rose-200"
                      >
                        Supprimer
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">Horodatage (s)</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-slate-300 px-3 py-2"
                          value={event.timestamp}
                          onChange={(e) => updateEvent(event.id, { timestamp: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">Type</span>
                        <select
                          className="w-full rounded border border-slate-300 px-3 py-2"
                          value={event.type}
                          onChange={(e) => updateEvent(event.id, { type: e.target.value as ScenarioEvent['type'] })}
                        >
                          <option value="ALARME_DM">Alarme DM</option>
                          <option value="ALARME_DAI">Alarme DAI</option>
                          <option value="DEFAUT_LIGNE">Défaut ligne</option>
                          <option value="COUPURE_SECTEUR">Coupure secteur</option>
                          <option value="DAS_BLOQUE">Blocage DAS</option>
                          <option value="UGA_HORS_SERVICE">UGA hors service</option>
                        </select>
                      </label>
                      {(event.type === 'ALARME_DM' || event.type === 'ALARME_DAI') && (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase text-slate-500">Zone concernée</span>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2"
                            value={payloadZoneId ?? ''}
                            onChange={(e) =>
                              updateEventPayload(event.id, (payload) => ({
                                ...payload,
                                zdId: e.target.value || undefined
                              }))
                            }
                          >
                            <option value="">Non défini</option>
                            {draft.zd.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {event.type === 'DAS_BLOQUE' && (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase text-slate-500">DAS concerné</span>
                          <select
                            className="w-full rounded border border-slate-300 px-3 py-2"
                            value={payloadDasId ?? ''}
                            onChange={(e) =>
                              updateEventPayload(event.id, (payload) => ({
                                ...payload,
                                dasId: e.target.value || undefined
                              }))
                            }
                          >
                            <option value="">Non défini</option>
                            {draft.das.map((das) => (
                              <option key={das.id} value={das.id}>
                                {das.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {(event.type === 'ALARME_DM' || event.type === 'ALARME_DAI') && (
                      <label className="mt-3 flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase text-slate-500">Périphérique déclencheur (optionnel)</span>
                        <select
                          className="w-full rounded border border-slate-300 px-3 py-2"
                          value={payloadPeripheralId ?? ''}
                          onChange={(e) =>
                            updateEventPayload(event.id, (payload) => ({
                              ...payload,
                              peripheralId: e.target.value || undefined
                            }))
                          }
                        >
                          <option value="">Non défini</option>
                          {(event.type === 'ALARME_DM' ? dmPeripherals : daiPeripherals).map((peripheral) => (
                            <option key={peripheral.id} value={peripheral.id}>
                              {peripheral.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          La console synchronise automatiquement les liens ZD → ZF → DAS et propose les périphériques pour les événements.
        </p>
      </div>
    </Card>
  );
};

const App = () => {
  const { connect, startScenario, scenarios, session, sessionId, trainerId, traineeId, connectionStatus, updateScenario } =
    useTrainerStore((state) => ({
      connect: state.connect,
      startScenario: state.startScenario,
      scenarios: state.scenarios,
      session: state.session,
      sessionId: state.sessionId,
      trainerId: state.trainerId,
      traineeId: state.traineeId,
      connectionStatus: state.connectionStatus,
      updateScenario: state.updateScenario
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
            <AccessManagementPanel />
            <TrainerControls scenario={scenario} />
          </aside>

          <main className="space-y-4">
            <Card title="Timeline">
              <Timeline />
            </Card>
            <ScenarioDetails scenario={scenario} />
            <Card title="Supervision des zones">
              {scenario ? (
                <div className="grid gap-4 text-sm lg:grid-cols-3">
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
                    <h4 className="text-xs font-semibold uppercase text-slate-500">Détection</h4>
                    <ul className="mt-2 space-y-1">
                      {scenario.peripherals.map((peripheral) => {
                        const zoneLabel = scenario.zd.find((zone) => zone.id === peripheral.zoneId)?.name ?? peripheral.zoneId;
                        const typeLabel = peripheral.type.replace(/_/g, ' ').toUpperCase();
                        return (
                          <li key={peripheral.id} className="rounded bg-slate-100 px-3 py-2">
                            <div className="text-xs font-semibold text-slate-700">{peripheral.name}</div>
                            <div className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                              {typeLabel} · {zoneLabel}
                            </div>
                          </li>
                        );
                      })}
                      {scenario.peripherals.length === 0 && (
                        <li className="rounded bg-slate-100 px-3 py-2 text-xs text-slate-500">Aucun périphérique configuré.</li>
                      )}
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
            <ScenarioEditor scenario={scenario} onUpdate={updateScenario} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
