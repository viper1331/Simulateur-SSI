import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Indicator } from '@ssi/ui-kit';
import { useTrainerStore } from './store';
import type { Scenario } from '@ssi/shared-models';

const formatDuration = (seconds?: number) => {
  if (seconds === undefined) return '--';
  return `${seconds.toString().padStart(2, '0')} s`;
};

const ScenarioSelector = ({ scenarios, onSelect }: { scenarios: Scenario[]; onSelect: (id: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {scenarios.map((scenario) => (
      <Button key={scenario.id} onClick={() => onSelect(scenario.id)} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
        {scenario.name}
      </Button>
    ))}
  </div>
);

const Timeline = () => {
  const timeline = useTrainerStore((state) => state.session?.timeline ?? []);
  return (
    <div className="max-h-96 overflow-y-auto space-y-2">
      {timeline.map((item) => (
        <div key={item.id} className="rounded border border-slate-200 bg-white p-3">
          <div className="text-xs uppercase text-slate-400">{item.category}</div>
          <div className="font-semibold text-slate-700">{item.message}</div>
          <div className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      {timeline.length === 0 && <p className="text-sm text-slate-500">Aucun événement enregistré pour le moment.</p>}
    </div>
  );
};

const ScorePanel = () => {
  const session = useTrainerStore((state) => state.session);
  return (
    <Card title="Scoring">
      <div className="space-y-2 text-sm text-slate-600">
        <div>Score courant : {session?.score ?? 0} pts</div>
        <div>Phase CMSI : {session?.cmsiPhase ?? 'idle'}</div>
        <div>T1 restant : {formatDuration(session?.t1Remaining)}</div>
        <div>T2 restant : {formatDuration(session?.t2Remaining)}</div>
      </div>
    </Card>
  );
};

const Dashboard = ({ scenario }: { scenario?: Scenario }) => {
  const triggerEvent = useTrainerStore((state) => state.triggerEvent);
  const stopScenario = useTrainerStore((state) => state.stopScenario);
  const session = useTrainerStore((state) => state.session);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <ScorePanel />
        <Card title="Commandes formateur">
          <div className="space-y-2">
            <Button onClick={() => triggerEvent({ id: 'trainer-dm', scenarioId: scenario?.id ?? 'unknown', timestamp: Date.now(), type: 'ALARME_DM', payload: {} })} className="w-full bg-red-100 text-red-700 hover:bg-red-200">
              Injecter alarme DM
            </Button>
            <Button onClick={() => triggerEvent({ id: 'trainer-dai', scenarioId: scenario?.id ?? 'unknown', timestamp: Date.now(), type: 'ALARME_DAI', payload: {} })} className="w-full bg-amber-100 text-amber-700 hover:bg-amber-200">
              Injecter alarme DAI
            </Button>
            <Button onClick={() => triggerEvent({ id: 'trainer-das', scenarioId: scenario?.id ?? 'unknown', timestamp: Date.now(), type: 'DAS_BLOQUE', payload: { dasId: scenario?.das[0]?.id } })} className="w-full bg-rose-100 text-rose-700 hover:bg-rose-200">
              Bloquer un DAS
            </Button>
            <Button onClick={() => triggerEvent({ id: 'trainer-secteur', scenarioId: scenario?.id ?? 'unknown', timestamp: Date.now(), type: 'COUPURE_SECTEUR', payload: {} })} className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300">
              Simuler coupure secteur
            </Button>
            <Button onClick={stopScenario} className="w-full bg-slate-900 text-white hover:bg-black">
              Arrêter le scénario
            </Button>
          </div>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <Card title="Timeline">
          <Timeline />
        </Card>
        <Card title="Supervision des zones">
          {scenario ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500">Zones de détection</h4>
                <ul className="mt-2 space-y-1">
                  {scenario.zd.map((zone) => (
                    <li key={zone.id} className="flex items-center justify-between rounded bg-slate-100 px-3 py-2">
                      <span>{zone.name}</span>
                      <Indicator label={`ZD ${zone.id}`} active />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500">DAS</h4>
                <ul className="mt-2 space-y-1">
                  {scenario.das.map((das) => (
                    <li key={das.id} className="flex items-center justify-between rounded bg-slate-100 px-3 py-2">
                      <span>{das.name}</span>
                      <Indicator label={useTrainerStore.getState().session?.dasStatus[das.id] ?? das.status} active={useTrainerStore.getState().session?.dasStatus[das.id] !== 'en_position'} tone="warning" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun scénario actif.</p>
          )}
        </Card>
      </div>
    </div>
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
  const connect = useTrainerStore((state) => state.connect);
  const startScenario = useTrainerStore((state) => state.startScenario);
  const scenarios = useTrainerStore((state) => state.scenarios);
  const session = useTrainerStore((state) => state.session);
  const scenario = useMemo(() => scenarios.find((item) => item.id === session?.scenarioId), [scenarios, session?.scenarioId]);

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Console Formateur SSI</h1>
            <p className="text-slate-500">Pilotez les événements, suivez l'apprenant et exportez le scoring.</p>
          </div>
          <ScenarioSelector scenarios={scenarios} onSelect={startScenario} />
        </header>
        <Dashboard scenario={scenario} />
        <ScenarioEditor
          scenario={scenario}
          onUpdate={(updated) => {
            console.log('Scenario updated (client-side)', updated);
          }}
        />
      </div>
    </div>
  );
};

export default App;
