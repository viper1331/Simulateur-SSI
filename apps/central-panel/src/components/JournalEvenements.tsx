import { useMemo, useState } from 'react';
import { CentralEvent } from '../state/CentralProvider';

export type JournalEvenementsProps = {
  events: CentralEvent[];
};

const filterOptions = [
  { label: 'Tous', value: 'all' },
  { label: 'Système', value: 'system' },
  { label: 'Actions', value: 'action' },
  { label: 'Injections', value: 'inject' }
] as const;

type FilterValue = (typeof filterOptions)[number]['value'];

const JournalEvenements = ({ events }: JournalEvenementsProps) => {
  const [filter, setFilter] = useState<FilterValue>('all');
  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((event) => event.type === filter);
  }, [events, filter]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Journal complet</h2>
        <div className="flex gap-2 text-xs text-slate-300">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-1 uppercase tracking-widest transition-all ${
                option.value === filter
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <div className="h-96 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/80 p-4 font-mono text-xs text-slate-100">
        {filtered.length === 0 ? (
          <p className="text-slate-500">Aucun événement pour ce filtre.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="text-[0.65rem] text-slate-400">
                  {new Date(event.at).toLocaleTimeString()}
                </span>
                <span className="flex-1 text-slate-100">{event.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default JournalEvenements;
