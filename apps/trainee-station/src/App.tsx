import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from './store';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { cmsiMachine } from '@ssi/state-machines';
import { useMachine } from '@xstate/react';
import type { AccessLevel, DetectionPeripheral, Scenario } from '@ssi/shared-models';
import { ACCESS_CODES, ACCESS_LEVELS, initialScoreRules } from '@ssi/shared-models';

type ActiveAlarms = { dm: string[]; dai: string[] };

const detectionTypeLabels: Record<DetectionPeripheral['type'], string> = {
  dm: 'Déclencheur manuel',
  dai: 'Détecteur automatique',
  detecteur_chaleur: 'Détecteur de chaleur',
  detecteur_fumee: 'Détecteur de fumée',
  autre: 'Point de détection'
};

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

type SessionData = ReturnType<typeof useSessionStore.getState>['session'];

type StatusItem = { label: string; active: boolean; tone: 'danger' | 'warning' | 'ok' };

const buildCmsiStatusItems = (session?: SessionData): StatusItem[] => {
  const ugaActive = session?.ugaActive ?? false;
  const dasStatus = session?.dasStatus ?? {};
  const alimentation = session?.alimentation ?? 'secteur';
  const outOfService = session?.outOfService ?? { zd: [], das: [] };
  const cmsiPhase = session?.cmsiPhase ?? 'idle';
  const outOfServiceCount = outOfService.zd.length + outOfService.das.length;
  const hasDasIssue = Object.values(dasStatus).some((status) => status !== 'en_position');

  return [
    { label: 'Alarme feu', active: cmsiPhase === 'preAlerte' || cmsiPhase === 'alerte', tone: 'danger' },
    { label: 'UGA active', active: ugaActive, tone: 'danger' },
    { label: 'Défaut alimentation', active: alimentation !== 'secteur', tone: 'warning' },
    { label: 'Surveillance DAS', active: hasDasIssue, tone: 'warning' },
    { label: 'Mises hors service', active: outOfServiceCount > 0, tone: 'warning' }
  ];
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const buildDetectionMessages = (scenario?: Scenario, activeAlarms?: ActiveAlarms): string[] => {
  if (!scenario || !activeAlarms) {
    return [];
  }
  const zoneNameById = new Map<string, string>();
  (scenario?.zd ?? []).forEach((zone) => zoneNameById.set(zone.id, zone.name));
  const formatLabel = (type: 'DM' | 'DAI') => (zoneId: string) => {
    const zoneLabel = zoneNameById.get(zoneId) ?? zoneId.toUpperCase();
    return `${type} ${zoneId.toUpperCase()} - ${zoneLabel}`;
  };
  const dmMessages = (activeAlarms.dm ?? []).map(formatLabel('DM'));
  const daiMessages = (activeAlarms.dai ?? []).map(formatLabel('DAI'));
  return [...dmMessages, ...daiMessages];
};

const buildDetectionLines = (scenario?: Scenario, activeAlarms?: ActiveAlarms): string[] => {
  const messages = buildDetectionMessages(scenario, activeAlarms);
  return messages.length > 0 ? chunk(messages, 2).map((items) => items.join('  |  ')) : [];
};

const getZoneAlarmTags = (zoneId: string, activeAlarms?: ActiveAlarms): string => {
  if (!activeAlarms) {
    return '';
  }
  const tags: string[] = [];
  if (activeAlarms.dm?.includes(zoneId)) {
    tags.push('DM');
  }
  if (activeAlarms.dai?.includes(zoneId)) {
    tags.push('DAI');
  }
  return tags.length > 0 ? ` ⚠ ${tags.join(' / ')}` : '';
};

const EcsPanel = ({
  scenario,
  session,
  sessionId,
  connectionLabel,
  connectionTone,
  statusItems
}: {
  scenario?: Scenario;
  session?: SessionData;
  sessionId?: string | null;
  connectionLabel: string;
  connectionTone: 'ok' | 'warning' | 'danger';
  statusItems: StatusItem[];
}) => {
  const detectionTree = useMemo(
    () =>
      scenario
        ? scenario.zd.map((zone) => ({
            zone,
            peripherals: (scenario.peripherals ?? []).filter((peripheral) => peripheral.zoneId === zone.id)
          }))
        : [],
    [scenario]
  );

  const [panelMode, setPanelMode] = useState<'summary' | 'tree'>('summary');
  const [treeState, setTreeState] = useState<{ zoneIndex: number; peripheralIndex: number | null }>(
    { zoneIndex: 0, peripheralIndex: null }
  );

  useEffect(() => {
    setTreeState({ zoneIndex: 0, peripheralIndex: null });
  }, [scenario?.id]);

  useEffect(() => {
    if (!scenario && panelMode === 'tree') {
      setPanelMode('summary');
    }
  }, [panelMode, scenario]);

  useEffect(() => {
    setTreeState((prev) => {
      if (detectionTree.length === 0) {
        if (prev.zoneIndex === 0 && prev.peripheralIndex === null) {
          return prev;
        }
        return { zoneIndex: 0, peripheralIndex: null };
      }
      const safeZoneIndex = Math.min(prev.zoneIndex, detectionTree.length - 1);
      const zone = detectionTree[safeZoneIndex];
      if (!zone) {
        return { zoneIndex: 0, peripheralIndex: null };
      }
      if (zone.peripherals.length === 0) {
        if (safeZoneIndex === prev.zoneIndex && prev.peripheralIndex === null) {
          return prev;
        }
        return { zoneIndex: safeZoneIndex, peripheralIndex: null };
      }
      const safePeripheralIndex =
        prev.peripheralIndex === null
          ? null
          : Math.min(prev.peripheralIndex, zone.peripherals.length - 1);
      if (safeZoneIndex === prev.zoneIndex && safePeripheralIndex === prev.peripheralIndex) {
        return prev;
      }
      return { zoneIndex: safeZoneIndex, peripheralIndex: safePeripheralIndex };
    });
  }, [detectionTree]);

  const handleTreeUp = useCallback(() => {
    if (detectionTree.length === 0) return;
    setTreeState((prev) => {
      if (prev.peripheralIndex === null) {
        const nextZoneIndex = (prev.zoneIndex - 1 + detectionTree.length) % detectionTree.length;
        return { zoneIndex: nextZoneIndex, peripheralIndex: null };
      }
      if (prev.peripheralIndex > 0) {
        return { ...prev, peripheralIndex: prev.peripheralIndex - 1 };
      }
      return { zoneIndex: prev.zoneIndex, peripheralIndex: null };
    });
  }, [detectionTree]);

  const handleTreeDown = useCallback(() => {
    if (detectionTree.length === 0) return;
    setTreeState((prev) => {
      const zone = detectionTree[Math.min(prev.zoneIndex, detectionTree.length - 1)];
      if (!zone) {
        return prev;
      }
      if (prev.peripheralIndex === null) {
        if (zone.peripherals.length > 0) {
          return { zoneIndex: prev.zoneIndex, peripheralIndex: 0 };
        }
        if (detectionTree.length === 1) {
          return prev;
        }
        const nextZoneIndex = (prev.zoneIndex + 1) % detectionTree.length;
        return { zoneIndex: nextZoneIndex, peripheralIndex: null };
      }
      if (zone.peripherals.length === 0) {
        return { zoneIndex: prev.zoneIndex, peripheralIndex: null };
      }
      const nextPeripheralIndex = prev.peripheralIndex + 1;
      if (nextPeripheralIndex < zone.peripherals.length) {
        return { ...prev, peripheralIndex: nextPeripheralIndex };
      }
      if (detectionTree.length === 1) {
        return { zoneIndex: prev.zoneIndex, peripheralIndex: 0 };
      }
      const nextZoneIndex = (prev.zoneIndex + 1) % detectionTree.length;
      const nextZone = detectionTree[nextZoneIndex];
      return {
        zoneIndex: nextZoneIndex,
        peripheralIndex: nextZone.peripherals.length > 0 ? 0 : null
      };
    });
  }, [detectionTree]);

  const handleTreeSelect = useCallback(() => {
    if (detectionTree.length === 0) return;
    setTreeState((prev) => {
      const zone = detectionTree[Math.min(prev.zoneIndex, detectionTree.length - 1)];
      if (!zone) {
        return prev;
      }
      if (prev.peripheralIndex === null && zone.peripherals.length > 0) {
        return { zoneIndex: prev.zoneIndex, peripheralIndex: 0 };
      }
      return prev;
    });
  }, [detectionTree]);

  const handleTreeBack = useCallback(() => {
    setTreeState((prev) =>
      prev.peripheralIndex === null ? prev : { zoneIndex: prev.zoneIndex, peripheralIndex: null }
    );
  }, []);

  useEffect(() => {
    if (panelMode !== 'tree') return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleTreeUp();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleTreeDown();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        handleTreeSelect();
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        handleTreeBack();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleTreeBack, handleTreeDown, handleTreeSelect, handleTreeUp, panelMode]);

  const detectionLines = buildDetectionLines(scenario, session?.activeAlarms);
  const connectionLine = `CONNEXION: ${connectionLabel.toUpperCase()}`;
  const summaryLines = [
    scenario
      ? `SCENARIO: ${scenario.name.toUpperCase()} (${scenario.zd.length} ZD / ${scenario.das.length} DAS)`
      : 'SCENARIO: AUCUN',
    `PHASE: ${(session?.cmsiPhase ?? 'REPOS').toString().toUpperCase()} | SESSION ${sessionId ?? '—'}`,
    detectionLines[0] ?? 'AUCUNE DETECTION EN ALARME',
    detectionLines[1] ?? connectionLine
  ];

  const activeZone = detectionTree[Math.min(treeState.zoneIndex, detectionTree.length - 1)];
  const selectedPeripheral =
    activeZone && treeState.peripheralIndex !== null
      ? activeZone.peripherals[treeState.peripheralIndex] ?? undefined
      : undefined;

  const treeLines = (() => {
    if (!scenario) {
      return ['MODE: ARBRE DETECTION', 'AUCUN SCENARIO EN COURS', '—', connectionLine];
    }
    if (!activeZone) {
      return ['MODE: ARBRE DETECTION', 'AUCUNE ZONE DEFINIE', '—', connectionLine];
    }
    const zoneCountLabel = `${treeState.zoneIndex + 1}/${detectionTree.length || 1}`;
    const zoneLinePrefix = treeState.peripheralIndex === null ? '>' : ' ';
    const zoneAlarmTags = getZoneAlarmTags(activeZone.zone.id, session?.activeAlarms);
    const zoneLine = `${zoneLinePrefix} ZD ${activeZone.zone.id.toUpperCase()} - ${activeZone.zone.name}${zoneAlarmTags} (${zoneCountLabel})`;

    if (activeZone.peripherals.length === 0) {
      return [
        'MODE: ARBRE DETECTION',
        zoneLine,
        '  Aucun point de détection associé',
        'CMD: ▲▼ NAVIGUER  ⤺ RETOUR'
      ];
    }

    if (treeState.peripheralIndex === null) {
      return [
        'MODE: ARBRE DETECTION',
        zoneLine,
        `  ${activeZone.peripherals.length} point(s) de détection — ↲ pour détailler`,
        'CMD: ▲▼ NAVIGUER  ↲ ENTRER  ⤺ RETOUR'
      ];
    }

    const typeKey: DetectionPeripheral['type'] = selectedPeripheral?.type ?? 'autre';
    const typeLabel = detectionTypeLabels[typeKey];
    const periphIndexLabel = `${treeState.peripheralIndex + 1}/${activeZone.peripherals.length}`;
    const periphLine = `> ${selectedPeripheral?.name ?? 'Point inconnu'} (${typeLabel})${zoneAlarmTags}`;
    return [
      'MODE: ARBRE DETECTION',
      zoneLine,
      periphLine,
      `CMD: ▲▼ NAVIGUER  ⤺ RETOUR  · ${periphIndexLabel}`
    ];
  })();

  const screenLines = panelMode === 'tree' ? treeLines : summaryLines;

  const keypadButtons = [
    {
      label: '▲',
      onClick: handleTreeUp,
      disabled: panelMode !== 'tree' || detectionTree.length === 0,
      ariaLabel: "Monter dans l'arbre de détection"
    },
    {
      label: '▼',
      onClick: handleTreeDown,
      disabled: panelMode !== 'tree' || detectionTree.length === 0,
      ariaLabel: "Descendre dans l'arbre de détection"
    },
    {
      label: '↲',
      onClick: handleTreeSelect,
      disabled:
        panelMode !== 'tree' || !activeZone || activeZone.peripherals.length === 0,
      ariaLabel: 'Entrer dans la zone sélectionnée'
    },
    {
      label: '⤺',
      onClick: handleTreeBack,
      disabled: panelMode !== 'tree' || treeState.peripheralIndex === null,
      ariaLabel: 'Revenir au niveau zone'
    }
  ];

  const getViewButtonClass = (mode: 'summary' | 'tree') =>
    `ecs-panel__view-button ${panelMode === mode ? 'ecs-panel__view-button--active' : ''}`;

  return (
    <section className="ecs-panel">
      <header className="ecs-panel__header">
        <span className="ecs-panel__title">ECS</span>
        <Indicator label={connectionLabel} tone={connectionTone} active />
      </header>
      <div className="ecs-panel__body">
        <div className="ecs-panel__screen">
          {screenLines.map((line, index) => (
            <div key={`${line}-${index}`} className="ecs-panel__line">
              {line}
            </div>
          ))}
        </div>
        <div className="ecs-panel__status">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className={`ecs-led ecs-led--${item.tone} ${item.active ? 'ecs-led--active' : ''}`}
            >
              <span className="ecs-led__dot" />
              <span className="ecs-led__label">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="ecs-panel__controls">
          <div className="ecs-panel__view-switch">
            <button
              type="button"
              className={getViewButtonClass('summary')}
              onClick={() => setPanelMode('summary')}
            >
              Synthèse
            </button>
            <button
              type="button"
              className={getViewButtonClass('tree')}
              onClick={() => setPanelMode('tree')}
              disabled={!scenario}
              title={
                scenario
                  ? undefined
                  : "Lancer un scénario pour afficher l'arbre de détection"
              }
            >
              Arbre de détection
            </button>
          </div>
          <div className="ecs-panel__keypad">
            {keypadButtons.map((key) => (
              <button
                key={key.label}
                type="button"
                className="ecs-panel__key"
                onClick={key.onClick}
                disabled={key.disabled}
                aria-label={key.ariaLabel}
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const UaeStation = ({ children }: { children: ReactNode }) => (
  <section className="uae-station">
    <header className="uae-station__header">UAE</header>
    <div className="uae-station__body">
      <div className="uae-station__monitor">{children}</div>
      <div className="uae-station__base" />
    </div>
  </section>
);

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
  session,
  scenario,
  statusItems,
  connectionStatus,
  onAck,
  onReset,
  onStopUGA,
  onToggleOutOfService
}: {
  accessLevel: AccessLevel;
  session?: SessionData;
  scenario?: Scenario;
  statusItems: StatusItem[];
  connectionStatus: string;
  onAck: () => void;
  onReset: () => void;
  onStopUGA: () => void;
  onToggleOutOfService: (targetType: 'zd' | 'das', targetId: string, active: boolean, label: string) => void;
}) => {
  const dasStatus = session?.dasStatus ?? {};
  const outOfService = session?.outOfService ?? { zd: [], das: [] };
  const activeAlarms = session?.activeAlarms ?? { dm: [], dai: [] };
  const timeline = session?.timeline ?? [];
  const lastEvents = timeline.slice(-4).reverse();

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

  const detectionLines = buildDetectionLines(scenario, activeAlarms);
  const connectionLine = `CONNEXION: ${(connectionStatus ?? 'inconnu').toUpperCase()}`;
  const ledLines = [
    scenario ? `SCENARIO: ${scenario.name.toUpperCase()}` : 'SCENARIO: AUCUN',
    `PHASE: ${(session?.cmsiPhase ?? 'REPOS').toString().toUpperCase()}`,
    detectionLines[0] ?? 'AUCUNE DETECTION EN ALARME',
    detectionLines[1] ?? connectionLine
  ];

  const authorizedServiceToggle = accessLevel >= 3;
  const canAck = accessLevel >= 1;
  const canReset = accessLevel >= 2;
  const canStopUGA = accessLevel >= 2;
  const canTest = accessLevel >= 1;

  return (
    <section className="smsi-board">
      <div className="smsi-board__grid">
        <div className="smsi-section smsisection--cmsi">
          <div className="smsi-section__label">CMSI</div>
          <div className="smsi-led-screen">
            {ledLines.map((line, index) => (
              <div key={`led-${index}`} className="smsi-led-screen__line">
                {line}
              </div>
            ))}
          </div>
          <div className="smsi-timers">
            <TemporisationBar label="Temporisation T1" value={session?.t1Remaining} max={session?.t1} />
            <TemporisationBar label="Temporisation T2" value={session?.t2Remaining} max={session?.t2} />
          </div>
          <div className="smsi-controls">
            <Button
              onClick={onAck}
              className="ssi-control-button ssi-control-button--ack"
              disabled={!canAck}
              title={canAck ? undefined : 'Accès SSI 1 requis'}
            >
              Acquitter
            </Button>
            <Button
              onClick={onReset}
              className="ssi-control-button ssi-control-button--reset"
              disabled={!canReset}
              title={canReset ? undefined : 'Accès SSI 2 requis'}
            >
              Réarmement
            </Button>
            <Button
              onClick={onStopUGA}
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
          <div className="smsi-section__footer">État machine : {String(cmsiSnapshot.value)}</div>
        </div>
        <div className="smsi-section smsisection--uga">
          <div className="smsi-section__label">UGA</div>
          <div className="smsi-lights">
            {statusItems.map((item) => (
              <div
                key={item.label}
                className={`smsi-light smsi-light--${item.tone} ${item.active ? 'smsi-light--active' : ''}`}
              >
                <span className="smsi-light__dot" />
                <span className="smsi-light__label">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="smsi-events">
            <h4>Historique récent</h4>
            {lastEvents.length === 0 ? (
              <p className="smsi-events__placeholder">En attente d'événements…</p>
            ) : (
              <ul>
                {lastEvents.map((event) => (
                  <li key={event.id}>
                    <span className="smsi-events__time">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                    <span className="smsi-events__label">{event.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="smsi-section smsisection--us">
          <div className="smsi-section__label">US</div>
          <VisualAlarmPanel scenario={scenario} activeAlarms={activeAlarms} />
        </div>
        <div className="smsi-section smsisection--ucms">
          <div className="smsi-section__label">UCMS</div>
          <div className="smsi-service-columns">
            <div className="smsi-service-columns__group">
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
                          onClick={() => onToggleOutOfService('zd', zone.id, !isOut, zone.name)}
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
            <div className="smsi-service-columns__group">
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
                          onClick={() => onToggleOutOfService('das', das.id, !isOut, das.name)}
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
        </div>
      </div>
      <div className="smsi-section smsisection--details">
        <div className="smsi-section__label">US détails</div>
        {scenario ? (
          <div className="smsi-details-grid">
            <div className="smsi-details-grid__column">
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
            </div>
            <div className="smsi-details-grid__column">
              <div className="smsi-events smsievents--stacked">
                <h4>Chronologie CMSI</h4>
                {timeline.length === 0 ? (
                  <p className="smsi-events__placeholder">Aucun événement enregistré pour le moment.</p>
                ) : (
                  <ul>
                    {timeline.slice(-8).reverse().map((event) => (
                      <li key={event.id}>
                        <span className="smsi-events__time">
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                        <span className="smsi-events__label">{event.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="ssi-synoptic-placeholder">Aucun scénario en cours</div>
        )}
      </div>
    </section>
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
  const ack = useSessionStore((state) => state.ack);
  const reset = useSessionStore((state) => state.reset);
  const stopUGA = useSessionStore((state) => state.stopUGA);
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

  const cmsiStatusItems = useMemo(() => buildCmsiStatusItems(session), [session]);

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
    <div className="trainee-shell">
      <header className="trainee-shell__banner">
        <div>
          <h1 className="trainee-shell__title">Poste Apprenant CMSI</h1>
          <p className="trainee-shell__subtitle">
            Version {__APP_VERSION__} – entraînez-vous à l'exploitation d'un SSI de catégorie A.
          </p>
        </div>
        <div className="trainee-shell__meta">
          <Indicator label={connectionLabel} tone={connectionTone} active />
          <div className="trainee-shell__user">
            <span className="trainee-shell__user-name">{auth.user.name}</span>
            <span className="trainee-shell__user-mail">{auth.user.email}</span>
            {sessionId && <span className="trainee-shell__session">Session : {sessionId}</span>}
          </div>
          <Button className="trainee-shell__logout" onClick={logout}>
            Se déconnecter
          </Button>
        </div>
      </header>
      <main className="trainee-shell__content">
        <EcsPanel
          scenario={scenario}
          session={session}
          sessionId={sessionId}
          connectionLabel={connectionLabel}
          connectionTone={connectionTone}
          statusItems={cmsiStatusItems}
        />
        <div className="trainee-shell__grid">
          <CmsiFacade
            accessLevel={activeAccessLevel}
            session={session}
            scenario={scenario}
            statusItems={cmsiStatusItems}
            connectionStatus={connectionStatus}
            onAck={ack}
            onReset={reset}
            onStopUGA={stopUGA}
            onToggleOutOfService={handleOutOfServiceToggle}
          />
          <UaeStation>
            <AccessLevelStatus
              grantedLevel={grantedAccessLevel}
              activeLevel={activeAccessLevel}
              onActivate={handleActivateAccessLevel}
              onRelease={handleReleaseAccessLevel}
            />
            <div className="uae-station__grid">
              <ScenarioBriefing scenario={scenario} />
              <ActionChecklist session={session} />
            </div>
            <Dashboard scenario={scenario} />
            {session?.trainerId && (
              <div className="uae-station__trainer">
                Formateur connecté : <span>{session.trainerId}</span>
              </div>
            )}
          </UaeStation>
        </div>
      </main>
      <Buzzer active={session?.ugaActive ?? false} />
    </div>
  );
};

export default App;
