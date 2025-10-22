import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from './store';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { cmsiMachine } from '@ssi/state-machines';
import { useMachine } from '@xstate/react';
import type { AccessLevel, Scenario } from '@ssi/shared-models';
import { ACCESS_CODES, ACCESS_LEVELS, initialScoreRules } from '@ssi/shared-models';

type ActiveAlarms = { dm: string[]; dai: string[] };

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
  <div className="rounded border border-slate-200 bg-white p-2">
    <div className="flex items-center gap-2">
      <span
        className={`h-4 w-4 rounded-full border border-slate-300 transition-all ${
          items.length > 0 ? colorClass : 'bg-slate-200'
        }`}
      />
      <span className="text-xs font-semibold uppercase text-slate-600">{label}</span>
      {items.length > 0 && (
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-500">
          {items.length}
        </span>
      )}
    </div>
    {items.length > 0 ? (
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-xs text-slate-500">{emptyLabel}</p>
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

const AccessLevelStatus = ({
  grantedLevel,
  activeLevel,
  onActivate,
  onRelease
}: {
  grantedLevel: AccessLevel;
  activeLevel: AccessLevel;
  onActivate: (level: Exclude<AccessLevel, 0>) => void;
  onRelease: () => void;
}) => {
  const managedLevels = [1, 2, 3] as const;
  const grantedTone = grantedLevel === 0 ? 'warning' : 'ok';
  const activeTone = activeLevel === 0 ? 'warning' : 'ok';
  const [pendingLevel, setPendingLevel] = useState<Exclude<AccessLevel, 0> | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingLevel && pendingLevel > grantedLevel) {
      setPendingLevel(null);
      setCodeInput('');
      setCodeError(null);
    }
  }, [grantedLevel, pendingLevel]);

  const helperMessage =
    grantedLevel === 0
      ? "En attente d'une autorisation du formateur pour libérer un niveau."
      : `Le formateur a autorisé l'accès ${ACCESS_LEVELS[grantedLevel].label}. Saisissez le code associé pour libérer le niveau souhaité.`;

  const handleRequestActivation = (level: Exclude<AccessLevel, 0>) => {
    if (level > grantedLevel) return;
    setPendingLevel(level);
    setCodeInput('');
    setCodeError(null);
  };

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingLevel) return;
    const expectedCode = ACCESS_CODES.find((item) => item.level === pendingLevel)?.code;
    if (expectedCode && expectedCode === codeInput.trim()) {
      onActivate(pendingLevel);
      setPendingLevel(null);
      setCodeInput('');
      setCodeError(null);
      return;
    }
    setCodeError('Code incorrect, veuillez réessayer.');
  };

  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCodeInput(event.target.value);
    if (codeError) {
      setCodeError(null);
    }
  };

  const handleReleaseClick = () => {
    setPendingLevel(null);
    setCodeInput('');
    setCodeError(null);
    onRelease();
  };

  return (
    <Card title="Accès SSI">
      <div className="space-y-3 text-sm text-slate-600">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
            <span>Niveau autorisé (formateur)</span>
            <Indicator label={ACCESS_LEVELS[grantedLevel].label} tone={grantedTone} active />
          </div>
          <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
            <span>Niveau utilisé (apprenant)</span>
            <Indicator label={ACCESS_LEVELS[activeLevel].label} tone={activeTone} active />
          </div>
        </div>
        <p className="text-xs text-slate-500">{helperMessage}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {managedLevels.map((level) => {
            const isActive = level === activeLevel;
            const isGranted = level <= grantedLevel;
            return (
              <Button
                key={level}
                onClick={() => handleRequestActivation(level)}
                disabled={!isGranted || isActive}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activer {ACCESS_LEVELS[level].label}
              </Button>
            );
          })}
          <Button
            onClick={handleReleaseClick}
            disabled={activeLevel === 0}
            className="sm:col-span-2 bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Libérer l'accès
          </Button>
        </div>
        {pendingLevel && (
          <form
            onSubmit={handleCodeSubmit}
            className="space-y-2 rounded border border-indigo-100 bg-indigo-50 p-3 text-xs text-slate-600"
          >
            <p>
              Code requis pour {ACCESS_LEVELS[pendingLevel].label}. Entrez le code d'accès pour libérer ce niveau.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={codeInput}
                onChange={handleCodeChange}
                className="flex-1 rounded border border-indigo-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Code d'accès"
                aria-label={`Code d'accès pour ${ACCESS_LEVELS[pendingLevel].label}`}
              />
              <Button
                type="submit"
                className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                disabled={codeInput.trim().length === 0}
              >
                Valider le code
              </Button>
            </div>
            {codeError && <p className="text-xs font-medium text-rose-600">{codeError}</p>}
            <p className="text-[0.65rem] text-slate-500">
              Besoin d'un autre niveau ? Sélectionnez-le dans la liste ci-dessus pour saisir un nouveau code.
            </p>
          </form>
        )}
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Droits par niveau</h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {managedLevels.map((level) => {
              const rights = ACCESS_LEVELS[level].rights;
              const isActive = level === activeLevel;
              const isGranted = level <= grantedLevel;
              return (
                <li
                  key={`rights-${level}`}
                  className={
                    isActive
                      ? 'text-xs font-semibold text-slate-600'
                      : isGranted
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }
                >
                  <span className="text-slate-600">{ACCESS_LEVELS[level].label}</span>
                  {': '}
                  {rights.length > 0 ? rights.join(', ') : 'Aucun droit spécifique.'}
                  {isActive && <span className="ml-2 text-indigo-600">(utilisé)</span>}
                  {!isActive && isGranted && <span className="ml-2 text-slate-500">(autorisé)</span>}
                  {!isGranted && <span className="ml-2 text-slate-400">(non autorisé)</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
};

const OutOfServicePanel = ({
  scenario,
  outOfService,
  accessLevel,
  onToggle
}: {
  scenario?: Scenario;
  outOfService?: { zd: string[]; das: string[] };
  accessLevel: AccessLevel;
  onToggle: (targetType: 'zd' | 'das', targetId: string, active: boolean, label: string) => void;
}) => {
  const authorized = accessLevel >= 3;
  if (!scenario) {
    return (
      <Card title="Gestion des mises hors service">
        <p className="text-sm text-slate-500">En attente du lancement d'un scénario pour gérer les organes.</p>
      </Card>
    );
  }

  const zoneOut = new Set(outOfService?.zd ?? []);
  const dasOut = new Set(outOfService?.das ?? []);

  return (
    <Card title="Gestion des mises hors service">
      {!authorized && (
        <p className="text-xs text-amber-600">
          Accès SSI 3 requis pour modifier l'état des zones ou des DAS.
        </p>
      )}
      <div className="mt-3 space-y-4 text-sm text-slate-600">
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Zones de détection</h4>
          <div className="mt-2 space-y-2">
            {scenario.zd.map((zone) => {
              const isOut = zoneOut.has(zone.id);
              const actionLabel = isOut ? 'Remettre en service' : 'Mettre hors service';
              const actionTone = isOut
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-rose-100 text-rose-700 hover:bg-rose-200';
              return (
                <div key={zone.id} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{zone.name}</div>
                      <div className="text-xs text-slate-500">ZD {zone.id}</div>
                    </div>
                    <Indicator label={isOut ? 'Hors service' : 'En service'} tone={isOut ? 'warning' : 'ok'} active />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      disabled={!authorized}
                      onClick={() => onToggle('zd', zone.id, !isOut, zone.name)}
                      className={`${actionTone} disabled:bg-slate-200 disabled:text-slate-500`}
                      title={authorized ? undefined : 'Accès SSI 3 requis'}
                    >
                      {actionLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
            {scenario.zd.length === 0 && (
              <p className="text-xs text-slate-500">Aucune zone de détection déclarée dans ce scénario.</p>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-500">Dispositifs actionnés de sécurité</h4>
          <div className="mt-2 space-y-2">
            {scenario.das.map((das) => {
              const isOut = dasOut.has(das.id);
              const actionLabel = isOut ? 'Remettre en service' : 'Mettre hors service';
              const actionTone = isOut
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-rose-100 text-rose-700 hover:bg-rose-200';
              return (
                <div key={das.id} className="rounded border border-slate-200 bg-white p-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{das.name}</div>
                      <div className="text-xs text-slate-500 uppercase">{das.type}</div>
                    </div>
                    <Indicator label={isOut ? 'Hors service' : 'En service'} tone={isOut ? 'warning' : 'ok'} active />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      disabled={!authorized}
                      onClick={() => onToggle('das', das.id, !isOut, das.name)}
                      className={`${actionTone} disabled:bg-slate-200 disabled:text-slate-500`}
                      title={authorized ? undefined : 'Accès SSI 3 requis'}
                    >
                      {actionLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
            {scenario.das.length === 0 && (
              <p className="text-xs text-slate-500">Aucun DAS associé à ce scénario.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const Synoptic = ({ scenario }: { scenario?: Scenario }) => {
  const dasStatus = useSessionStore((state) => state.session?.dasStatus ?? {});
  const outOfService = useSessionStore((state) => state.session?.outOfService ?? { zd: [], das: [] });
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
                {outOfService.zd.includes(zone.id) && (
                  <span className="ml-2 text-xs font-semibold uppercase text-amber-600">HS</span>
                )}
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
                  {outOfService.das.includes(das.id) && (
                    <span className="ml-2 font-semibold uppercase text-amber-600">HS</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
  const outOfServiceActive =
    (session?.outOfService?.zd?.length ?? 0) + (session?.outOfService?.das?.length ?? 0) > 0;

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
    },
    {
      id: 'out-of-service',
      label: 'Surveiller les mises hors service',
      tone: outOfServiceActive ? 'warning' : 'ok',
      description: outOfServiceActive
        ? 'Des organes sont neutralisés : valider leur remise en service avant la fin du scénario.'
        : 'Aucune mise hors service active.'
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

const CmsiFacade = ({
  accessLevel,
  onToggleOutOfService
}: {
  accessLevel: AccessLevel;
  onToggleOutOfService: (targetType: 'zd' | 'das', targetId: string, active: boolean, label: string) => void;
}) => {
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
    if (session?.scenarioDefinition) {
      return session.scenarioDefinition;
    }
    const scenarioId = session?.scenarioId;
    if (!scenarioId) return undefined;
    return scenarios.find((scn) => scn.id === scenarioId);
  }, [session?.scenarioDefinition, scenarios, session?.scenarioId]);

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

  const outOfService = session?.outOfService ?? { zd: [], das: [] };
  const outOfServiceCount = outOfService.zd.length + outOfService.das.length;
  const activeAlarms = session?.activeAlarms ?? { dm: [], dai: [] };
  const canAck = accessLevel >= 1;
  const canReset = accessLevel >= 2;
  const canStopUGA = accessLevel >= 2;
  const canTest = accessLevel >= 1;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card title="Statut CMSI">
        <div className="space-y-2">
          <Indicator label="Alarme feu" active={session?.cmsiPhase === 'preAlerte' || session?.cmsiPhase === 'alerte'} tone="danger" />
          <Indicator label="UGA active" active={session?.ugaActive ?? false} tone="danger" />
          <Indicator label="Défaut alimentation" active={session?.alimentation !== 'secteur'} tone="warning" />
          <Indicator label="DAS" active={Object.values(session?.dasStatus ?? {}).some((status) => status !== 'en_position')} tone="warning" />
          <Indicator label="Hors service" active={outOfServiceCount > 0} tone="warning" />
        </div>
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase text-slate-500">Alarmes visuelles</h4>
          <VisualAlarmPanel scenario={scenario} activeAlarms={activeAlarms} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            onClick={ack}
            className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            disabled={!canAck}
            title={canAck ? undefined : 'Accès SSI 1 requis'}
          >
            Acquitter
          </Button>
          <Button
            onClick={reset}
            className="bg-sky-100 text-sky-700 hover:bg-sky-200"
            disabled={!canReset}
            title={canReset ? undefined : 'Accès SSI 2 requis'}
          >
            Réarmement
          </Button>
          <Button
            onClick={stopUGA}
            className="bg-amber-100 text-amber-700 hover:bg-amber-200"
            disabled={!canStopUGA}
            title={canStopUGA ? undefined : 'Accès SSI 2 requis'}
          >
            Arrêt évacuation
          </Button>
          <Button
            className="bg-slate-200 text-slate-700"
            onClick={() => alert('Test lampes enclenché')}
            disabled={!canTest}
            title={canTest ? undefined : 'Accès SSI 1 requis'}
          >
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
        <OutOfServicePanel
          scenario={scenario}
          outOfService={outOfService}
          accessLevel={accessLevel}
          onToggle={onToggleOutOfService}
        />
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
  const setOutOfService = useSessionStore((state) => state.setOutOfService);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const connect = useSessionStore((state) => state.connect);
  const auth = useSessionStore((state) => state.auth);
  const authError = useSessionStore((state) => state.authError);
  const login = useSessionStore((state) => state.login);
  const register = useSessionStore((state) => state.register);
  const logout = useSessionStore((state) => state.logout);
  const clearError = useSessionStore((state) => state.clearError);
  const sessionId = useSessionStore((state) => state.sessionId);
  const [activeAccessLevel, setActiveAccessLevel] = useState<AccessLevel>(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [formState, setFormState] = useState({ name: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (auth && connectionStatus === 'idle') {
      void connect();
    }
  }, [auth, connectionStatus, connect]);

  const scenario = useMemo(() => {
    if (session?.scenarioDefinition) {
      return session.scenarioDefinition;
    }
    if (!session?.scenarioId) return undefined;
    return scenarios.find((item) => item.id === session.scenarioId);
  }, [session?.scenarioDefinition, scenarios, session?.scenarioId]);

  const grantedAccessLevel: AccessLevel = session?.accessLevel ?? 0;

  useEffect(() => {
    setActiveAccessLevel((current) => (current > grantedAccessLevel ? grantedAccessLevel : current));
  }, [grantedAccessLevel]);

  const handleActivateAccessLevel = (level: Exclude<AccessLevel, 0>) => {
    if (level <= grantedAccessLevel) {
      setActiveAccessLevel(level);
    }
  };

  const handleReleaseAccessLevel = () => {
    setActiveAccessLevel(0);
  };

  const handleOutOfServiceToggle = (
    targetType: 'zd' | 'das',
    targetId: string,
    active: boolean,
    label: string
  ) => {
    setOutOfService({ targetType, targetId, active, label });
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const success =
      authMode === 'login'
        ? await login({ email: formState.email, password: formState.password })
        : await register({ name: formState.name, email: formState.email, password: formState.password });
    setIsSubmitting(false);
    if (success) {
      setFormState({ name: '', email: '', password: '' });
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleModeSwitch = () => {
    setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'));
    setFormState({ name: '', email: '', password: '' });
    clearError();
  };

  const connectionTone: 'ok' | 'warning' | 'danger' =
    connectionStatus === 'connected' ? 'ok' : connectionStatus === 'error' ? 'danger' : 'warning';
  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Serveur connecté'
      : connectionStatus === 'error'
      ? 'Serveur déconnecté'
      : connectionStatus === 'connecting'
      ? 'Connexion en cours'
      : 'En attente de connexion';

  if (!auth) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <header className="text-center">
            <h1 className="text-3xl font-bold text-slate-800">Poste Apprenant CMSI</h1>
            <p className="mt-1 text-sm text-slate-500">
              Version {__APP_VERSION__} – connectez-vous pour suivre votre session personnalisée.
            </p>
          </header>
          <Card title={authMode === 'login' ? 'Connexion apprenant' : 'Créer un compte apprenant'}>
            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label htmlFor="name" className="text-sm font-medium text-slate-600">
                    Nom complet
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={handleInputChange}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Jean Dupont"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-slate-600">
                  Adresse email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formState.email}
                  onChange={handleInputChange}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="vous@exemple.fr"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-600">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formState.password}
                  onChange={handleInputChange}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              {authError && <p className="text-sm text-red-600">{authError}</p>}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {isSubmitting
                  ? 'Veuillez patienter…'
                  : authMode === 'login'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
              </Button>
            </form>
          </Card>
          <div className="text-center text-sm text-slate-600">
            {authMode === 'login' ? (
              <span>
                Pas encore inscrit ?{' '}
                <button className="font-semibold text-indigo-600" type="button" onClick={handleModeSwitch}>
                  Créer un compte
                </button>
              </span>
            ) : (
              <span>
                Déjà inscrit ?{' '}
                <button className="font-semibold text-indigo-600" type="button" onClick={handleModeSwitch}>
                  Se connecter
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Poste Apprenant CMSI</h1>
            <p className="text-slate-500">
              Version {__APP_VERSION__} – entraînez-vous à l'exploitation d'un SSI de catégorie A.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-slate-600 md:items-end">
            <Indicator label={connectionLabel} tone={connectionTone} active />
            <div className="text-right">
              <div className="font-semibold text-slate-700">{auth.user.name}</div>
              <div className="text-xs text-slate-500">{auth.user.email}</div>
              {sessionId && <div className="text-xs text-slate-400">Session : {sessionId}</div>}
            </div>
            <Button className="bg-slate-200 text-slate-700 hover:bg-slate-300" onClick={logout}>
              Se déconnecter
            </Button>
          </div>
        </header>
        <AccessLevelStatus
          grantedLevel={grantedAccessLevel}
          activeLevel={activeAccessLevel}
          onActivate={handleActivateAccessLevel}
          onRelease={handleReleaseAccessLevel}
        />
        <CmsiFacade accessLevel={activeAccessLevel} onToggleOutOfService={handleOutOfServiceToggle} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScenarioBriefing scenario={scenario} />
          <ActionChecklist session={session} />
        </div>
        <Dashboard scenario={scenario} />
        {session?.trainerId && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Formateur connecté : <span className="font-semibold text-slate-700">{session.trainerId}</span>
          </div>
        )}
        <Buzzer active={session?.ugaActive ?? false} />
      </div>
    </div>
  );
};

export default App;
