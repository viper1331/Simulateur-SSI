import { useEffect, useMemo, useState } from 'react';
import FacadeLayout, { LedDescriptor } from './components/FacadeLayout';
import LcdDisplay from './components/LcdDisplay';
import KeyboardControls from './components/KeyboardControls';
import ChronoDisplay from './components/ChronoDisplay';
import JournalFacade from './components/JournalFacade';
import JournalEvenements from './components/JournalEvenements';
import AudioHub from './components/AudioHub';
import ShortcutsHelp from './components/ShortcutsHelp';
import {
  CentralProvider,
  useAlimentationSelector,
  useCentralActions,
  useCentralContext,
  useCentralSelector,
  useDasSelector
} from './state/CentralProvider';
import { useKioskMode } from './hooks/useKioskMode';

const useLedDescriptors = () => {
  const snapshot = useCentralSelector((state) => state);
  const dasState = useDasSelector((state) => state);
  const alimentationState = useAlimentationSelector((state) => state);
  const dasLabel = dasState.matches('defaut')
    ? 'Défaut position'
    : dasState.matches('commande')
    ? 'En déplacement'
    : 'En position';
  const matches = (value: string) => (snapshot as any).matches(value);

  return useMemo<LedDescriptor[]>(() => {
    const leds: LedDescriptor[] = [
      {
        id: 'alarme-feu',
        label: 'Alarme Feu',
        tone: 'danger',
        active:
          matches('preAlerte') || matches('alerte') || matches('ugaActive') || matches('attenteReset')
      },
      {
        id: 'defaut',
        label: 'Défaut',
        tone: 'warning',
        active: !snapshot.context.dasReady
      },
      {
        id: 'uga',
        label: 'Evacuation active',
        tone: 'danger',
        active: snapshot.context.ugaActive
      },
      {
        id: 'hors-service',
        label: 'Hors service',
        tone: 'info',
        active: snapshot.context.maskedZones.size > 0,
        subtitle: `${snapshot.context.maskedZones.size} zone(s)`
      },
      {
        id: 'secteur',
        label: 'Secteur',
        tone: 'success',
        active: alimentationState.matches('secteur')
      },
      {
        id: 'batterie',
        label: 'Batterie',
        tone: 'warning',
        active: !alimentationState.matches('secteur')
      },
      {
        id: 'das',
        label: 'DAS',
        tone: dasState.matches('defaut') ? 'warning' : 'success',
        active: true,
        subtitle: dasLabel
      }
    ];
    return leds;
  }, [snapshot, dasState, dasLabel, alimentationState]);
};

const AppShell = () => {
  const { events, timers } = useCentralContext();
  const snapshot = useCentralSelector((state) => state);
  const actions = useCentralActions();
  const leds = useLedDescriptors();
  useKioskMode();
  const [journalOpen, setJournalOpen] = useState(false);
  const [, setShortcutMask] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault();
          actions.acknowledge();
          break;
        case 'g':
          event.preventDefault();
          actions.forceEvacuation();
          break;
        case 's':
          event.preventDefault();
          actions.stopEvacuation();
          break;
        case 'r':
          event.preventDefault();
          actions.resetSystem();
          break;
        case 'b':
          event.preventDefault();
          actions.silenceBuzzer();
          break;
        case 'j':
          event.preventDefault();
          setJournalOpen((value) => !value);
          break;
        case 'm':
          event.preventDefault();
          setShortcutMask((value) => {
            const next = !value;
            actions.maskZone('ZD1', next);
            return next;
          });
          break;
        case 'k':
          event.preventDefault();
          actions.toggleKeyMode();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);

  const journalContent = (
    <div className="space-y-4">
      <JournalFacade events={events} onOpenFull={() => setJournalOpen(true)} />
      {journalOpen && (
        <div className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Journal complet</span>
            <button
              type="button"
              onClick={() => setJournalOpen(false)}
              className="rounded-md bg-slate-800 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-700"
            >
              Fermer
            </button>
          </div>
          <JournalEvenements events={events} />
        </div>
      )}
      <AudioHub buzzerActive={snapshot.context.buzzer} ugaActive={snapshot.context.ugaActive} />
    </div>
  );

  const keyboard = (
    <KeyboardControls
      onAck={actions.acknowledge}
      onEvacuation={actions.forceEvacuation}
      onStopEvacuation={actions.stopEvacuation}
      onReset={actions.resetSystem}
      onSilence={actions.silenceBuzzer}
      onTestLamps={actions.testLamps}
      onMaskZone={(zone, active) => actions.maskZone(zone, active)}
      keyMode={snapshot.context.keyMode}
      acked={snapshot.context.acked}
      buzzerActive={snapshot.context.buzzer}
    />
  );

  const chronos = (
    <ChronoDisplay
      t1Initial={timers.t1Initial}
      t2Initial={timers.t2Initial}
      t1Remaining={snapshot.context.t1Remaining}
      t2Remaining={snapshot.context.t2Remaining}
    />
  );

  return (
    <FacadeLayout
      leds={leds}
      lcd={<LcdDisplay lines={snapshot.context.lcdLines} statusLine={`Mode ${snapshot.context.keyMode}`} />}
      keyboard={keyboard}
      chronos={chronos}
      journal={journalContent}
      shortcuts={<ShortcutsHelp />}
    />
  );
};

const App = () => (
  <CentralProvider>
    <AppShell />
  </CentralProvider>
);

export default App;
