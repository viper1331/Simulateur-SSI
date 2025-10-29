import { useState } from 'react';
import { Button } from '@ssi/ui-kit';

type KeyboardControlsProps = {
  onAck: () => void;
  onEvacuation: () => void;
  onStopEvacuation: () => void;
  onReset: () => void;
  onSilence: () => void;
  onTestLamps: () => void;
  onMaskZone: (zoneId: string, active: boolean) => void;
  keyMode: string;
  acked: boolean;
  buzzerActive: boolean;
};

const zones = ['ZD1', 'ZD2', 'ZD3', 'ZF1'];

const KeyboardControls = ({
  onAck,
  onEvacuation,
  onStopEvacuation,
  onReset,
  onSilence,
  onTestLamps,
  onMaskZone,
  keyMode,
  acked,
  buzzerActive
}: KeyboardControlsProps) => {
  const [masked, setMasked] = useState<Set<string>>(new Set());

  const toggleZone = (zone: string) => {
    const next = new Set(masked);
    if (next.has(zone)) {
      next.delete(zone);
      onMaskZone(zone, false);
    } else {
      next.add(zone);
      onMaskZone(zone, true);
    }
    setMasked(next);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>Clavier &amp; commandes</span>
        <span className="text-[0.55rem] text-slate-500">Mode clef : {keyMode}</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button onClick={onAck} className="bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
          Acquitter (A)
        </Button>
        <Button onClick={onEvacuation} className="bg-red-600 text-sm font-semibold text-white hover:bg-red-700">
          Évacuation générale (G)
        </Button>
        <Button onClick={onStopEvacuation} className="bg-amber-600 text-sm font-semibold text-white hover:bg-amber-700">
          Arrêt évacuation (S)
        </Button>
        <Button onClick={onSilence} className="bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">
          Silence buzzer (B)
        </Button>
        <Button onClick={onTestLamps} className="bg-slate-700 text-sm font-semibold text-white hover:bg-slate-600">
          Test lampes
        </Button>
        <Button
          onClick={onReset}
          className="bg-slate-200 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          disabled={!acked}
        >
          Réarmement (R)
        </Button>
      </div>
      <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Masquages rapides (M)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {zones.map((zone) => {
            const isMasked = masked.has(zone);
            return (
              <Button
                key={zone}
                onClick={() => toggleZone(zone)}
                className={
                  isMasked
                    ? 'border border-amber-400 bg-amber-500/20 text-amber-200 hover:bg-amber-400/30'
                    : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }
              >
                {zone} {isMasked ? 'masquée' : 'active'}
              </Button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Buzzer {buzzerActive ? 'actif — utilisez Silence ou B' : 'silencieux'} • Réarmement disponible :
        {acked ? ' oui' : ' non'}
      </p>
    </div>
  );
};

export default KeyboardControls;
