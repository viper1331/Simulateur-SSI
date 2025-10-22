import { useEffect, useState } from 'react';
import logger, { LogEntry } from './logger';

type DebugConsoleProps = {
  open: boolean;
  onClose: () => void;
};

const levelStyles: Record<LogEntry['level'], string> = {
  debug: 'text-slate-500',
  info: 'text-sky-600',
  warn: 'text-amber-600',
  error: 'text-red-600'
};

const DebugConsole = ({ open, onClose }: DebugConsoleProps) => {
  const [entries, setEntries] = useState<LogEntry[]>(logger.getEntries());

  useEffect(() => logger.subscribe(setEntries), []);

  if (!open) return null;

  return (
    <div className="fixed inset-4 z-50 flex flex-col rounded-lg border border-slate-300 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Console de debug</h2>
          <p className="text-xs text-slate-500">
            Les derniers événements de la console sont listés ci-dessous. Utilisez ce panneau pour
            diagnostiquer la page blanche après connexion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => logger.clear()}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Fermer
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950/5 p-3 text-xs text-slate-700">
        {entries.length === 0 ? (
          <p className="text-center text-slate-500">Aucun événement enregistré pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {entries
              .slice()
              .reverse()
              .map((entry) => (
                <li key={entry.id} className="rounded border border-slate-200 bg-white p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold uppercase tracking-wide ${levelStyles[entry.level]}`}>
                      {entry.level}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{entry.timestamp}</span>
                  </div>
                  <p className="mt-1 text-slate-700">{entry.message}</p>
                  {entry.context !== undefined && (
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-950/5 p-2 text-[11px] text-slate-600">
                      {JSON.stringify(entry.context, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DebugConsole;
