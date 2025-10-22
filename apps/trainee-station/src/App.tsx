import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from './store';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { cmsiMachine } from '@ssi/state-machines';
import { useMachine } from '@xstate/react';
import type { AccessLevel, Scenario } from '@ssi/shared-models';
import { ACCESS_LEVELS, initialScoreRules } from '@ssi/shared-models';

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
    <div className="ssi-temporisation">
      <div className="ssi-temporisation__header">
        <span>{label}</span>
        <span>{value ?? '--'} s</span>
      </div>
      <div className="ssi-temporisation__track">
        <div className="ssi-temporisation__value" style={{ width: `${percentage}%` }} />
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
  <div className="visual-alarm">
    <div className="visual-alarm__header">
      <span className={`visual-alarm__led ${items.length > 0 ? colorClass : 'visual-alarm__led--idle'}`} />
      <span className="visual-alarm__label">{label}</span>
      {items.length > 0 && <span className="visual-alarm__count">{items.length}</span>}
    </div>
    {items.length > 0 ? (
      <ul className="visual-alarm__list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="visual-alarm__empty">{emptyLabel}</p>
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
    <div className="ssi-alarms">
      <VisualAlarmLamp
        label="DM en alarme"
        colorClass="visual-alarm__led--danger"
        items={dmItems}
        emptyLabel="Aucun DM déclenché."
      />
      <VisualAlarmLamp
        label="DAI en alarme"
        colorClass="visual-alarm__led--warning"
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
  const helperMessage =
    grantedLevel === 0
      ? "En attente d'une autorisation du formateur pour libérer un niveau."
      : `Le formateur a autorisé l'accès ${ACCESS_LEVELS[grantedLevel].label}. Libérez un niveau pour vos actions.`;

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
                onClick={() => onActivate(level)}
                disabled={!isGranted || isActive}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activer {ACCESS_LEVELS[level].label}
              </Button>
            );
          })}
          <Button
            onClick={onRelease}
            disabled={activeLevel === 0}
            className="sm:col-span-2 bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Libérer l'accès
          </Button>
        </div>
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
  const dasStatus = useSessionStore((state) => state.session?.dasStatus ?? {});
  const sessionId = useSessionStore((state) => state.sessionId);

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
  const timeline = session?.timeline ?? [];
  const lastEvents = timeline.slice(-3).reverse();

  const statusItems: Array<{ label: string; active: boolean; tone: 'danger' | 'warning' | 'ok' }> = [
    { label: 'Alarme feu', active: session?.cmsiPhase === 'preAlerte' || session?.cmsiPhase === 'alerte', tone: 'danger' },
    { label: 'UGA active', active: session?.ugaActive ?? false, tone: 'danger' },
    { label: 'Défaut alimentation', active: session?.alimentation !== 'secteur', tone: 'warning' },
    {
      label: 'Surveillance DAS',
      active: Object.values(session?.dasStatus ?? {}).some((status) => status !== 'en_position'),
      tone: 'warning'
    },
    { label: 'Mises hors service', active: outOfServiceCount > 0, tone: 'warning' }
  ];

  const authorizedServiceToggle = accessLevel >= 3;

  return (
    <div className="ssi-panel">
      <div className="ssi-panel__column ssi-panel__column--left">
        <section className="ssi-module ssi-module--controls">
          <header className="ssi-module__header">
            <div className="ssi-badge">CMSI Apprenant</div>
            <span className="ssi-module__subtitle">Catégorie A</span>
          </header>
          <div className="ssi-display">
            <div className="ssi-display__screen">
              <div className="ssi-display__line ssi-display__line--title">
                {scenario?.name ?? 'Aucun scénario sélectionné'}
              </div>
              <div className="ssi-display__line">Phase CMSI : {session?.cmsiPhase ?? 'Repos'}</div>
              <div className="ssi-display__line">Connexion : {connectionStatus}</div>
              <div className="ssi-display__line">Session : {sessionId ?? '—'}</div>
            </div>
            <div className="ssi-display__status">
              {statusItems.map((item) => (
                <div
                  key={item.label}
                  className={`ssi-led ssi-led--${item.tone} ${item.active ? 'ssi-led--active' : ''}`}
                >
                  <span className="ssi-led__dot" />
                  <span className="ssi-led__label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ssi-temporisations">
            <TemporisationBar label="Temporisation T1" value={session?.t1Remaining} max={session?.t1} />
            <TemporisationBar label="Temporisation T2" value={session?.t2Remaining} max={session?.t2} />
          </div>
          <div className="ssi-control-grid">
            <Button
              onClick={ack}
              className="ssi-control-button ssi-control-button--ack"
              disabled={!canAck}
              title={canAck ? undefined : 'Accès SSI 1 requis'}
            >
              Acquitter
            </Button>
            <Button
              onClick={reset}
              className="ssi-control-button ssi-control-button--reset"
              disabled={!canReset}
              title={canReset ? undefined : 'Accès SSI 2 requis'}
            >
              Réarmement
            </Button>
            <Button
              onClick={stopUGA}
              className="ssi-control-button ssi-control-button--uga"
              disabled={!canStopUGA}
              title={canStopUGA ? undefined : 'Accès SSI 2 requis'}
            >
              Arrêt évacuation
            </Button>
            <Button
              className="ssi-control-button ssi-control-button--test"
              onClick={() => alert('Test lampes enclenché')}
              disabled={!canTest}
              title={canTest ? undefined : 'Accès SSI 1 requis'}
            >
              Test lampes
            </Button>
          </div>
          <footer className="ssi-module__footer">
            <span className="ssi-module__footer-label">État machine</span>
            <span className="ssi-module__footer-value">{String(cmsiSnapshot.value)}</span>
          </footer>
        </section>
      </div>
      <div className="ssi-panel__column ssi-panel__column--center">
        <section className="ssi-module">
          <header className="ssi-section-header">
            <span className="ssi-section-header__title">Signalisations</span>
            <span className="ssi-section-header__badge">{activeAlarms.dm.length + activeAlarms.dai.length} actives</span>
          </header>
          <VisualAlarmPanel scenario={scenario} activeAlarms={activeAlarms} />
        </section>
        <section className="ssi-module">
          <header className="ssi-section-header">
            <span className="ssi-section-header__title">Gestion des organes</span>
            <span className="ssi-section-header__subtitle">
              {authorizedServiceToggle ? 'Commandes disponibles' : 'Accès SSI 3 requis'}
            </span>
          </header>
          <div className="ssi-service-grid">
            <div className="ssi-service-column">
              <h4>Zones de détection</h4>
              {scenario ? (
                <ul>
                  {scenario.zd.map((zone) => {
                    const isOut = outOfService.zd.includes(zone.id);
                    return (
                      <li key={zone.id} className={`ssi-service-card ${isOut ? 'ssi-service-card--out' : ''}`}>
                        <div className="ssi-service-card__info">
                          <span className="ssi-service-card__id">ZD {zone.id}</span>
                          <span className="ssi-service-card__label">{zone.name}</span>
                        </div>
                        <button
                          type="button"
                          className="ssi-service-card__action"
                          disabled={!authorizedServiceToggle}
                          onClick={() =>
                            onToggleOutOfService('zd', zone.id, !isOut, zone.name)
                          }
                          title={authorizedServiceToggle ? undefined : 'Accès SSI 3 requis'}
                        >
                          {isOut ? 'Remettre en service' : 'Mettre HS'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="ssi-placeholder">En attente d'un scénario…</p>
              )}
            </div>
            <div className="ssi-service-column">
              <h4>DAS associés</h4>
              {scenario ? (
                <ul>
                  {scenario.das.map((das) => {
                    const isOut = outOfService.das.includes(das.id);
                    return (
                      <li key={das.id} className={`ssi-service-card ${isOut ? 'ssi-service-card--out' : ''}`}>
                        <div className="ssi-service-card__info">
                          <span className="ssi-service-card__id">{das.type}</span>
                          <span className="ssi-service-card__label">{das.name}</span>
                        </div>
                        <button
                          type="button"
                          className="ssi-service-card__action"
                          disabled={!authorizedServiceToggle}
                          onClick={() =>
                            onToggleOutOfService('das', das.id, !isOut, das.name)
                          }
                          title={authorizedServiceToggle ? undefined : 'Accès SSI 3 requis'}
                        >
                          {isOut ? 'Remettre en service' : 'Mettre HS'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="ssi-placeholder">Aucun DAS chargé.</p>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="ssi-panel__column ssi-panel__column--right">
        <section className="ssi-module ssi-module--synoptic">
          <header className="ssi-section-header">
            <span className="ssi-section-header__title">Synoptique</span>
            <span className="ssi-section-header__subtitle">
              {scenario ? `${scenario.zd.length} zones / ${scenario.das.length} DAS` : 'Inactif'}
            </span>
          </header>
          {scenario ? (
            <div className="ssi-synoptic-screen">
              <div>
                <h4>Zones surveillées</h4>
                <ul>
                  {scenario.zd.map((zone) => (
                    <li key={zone.id}>
                      <span>{zone.name}</span>
                      {outOfService.zd.includes(zone.id) && <span className="ssi-tag">HS</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>DAS</h4>
                <ul>
                  {scenario.das.map((das) => (
                    <li key={das.id}>
                      <span>{das.name}</span>
                      <span className="ssi-sub">{dasStatus[das.id] ?? das.status}</span>
                      {outOfService.das.includes(das.id) && <span className="ssi-tag">HS</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="ssi-synoptic-placeholder">Aucun scénario en cours</div>
          )}
        </section>
        <section className="ssi-module">
          <header className="ssi-section-header">
            <span className="ssi-section-header__title">Derniers événements</span>
            <span className="ssi-section-header__subtitle">{timeline.length} enregistrés</span>
          </header>
          <div className="ssi-timeline">
            {lastEvents.length === 0 && <p className="ssi-placeholder">En attente d'événements…</p>}
            {lastEvents.map((event) => (
              <div key={event.id} className="ssi-timeline__item">
                <span className="ssi-timeline__time">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="ssi-timeline__label">{event.message}</span>
              </div>
            ))}
          </div>
        </section>
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
    <div className="min-h-screen bg-[#dfe3ee] p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/60 p-6 shadow-lg shadow-slate-900/10 backdrop-blur md:flex-row md:items-center md:justify-between">
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
