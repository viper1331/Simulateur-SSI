import { CentralEvent } from '../state/CentralProvider';
import { Button } from '@ssi/ui-kit';

export type JournalFacadeProps = {
  events: CentralEvent[];
  onOpenFull: () => void;
};

const JournalFacade = ({ events, onOpenFull }: JournalFacadeProps) => {
  const latest = [...events].slice(-5).reverse();
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>Journal façade</span>
        <Button onClick={onOpenFull} className="border border-slate-600 bg-slate-800 text-xs text-slate-100">
          Ouvrir journal complet (J)
        </Button>
      </header>
      <div className="max-h-48 overflow-hidden rounded-md border border-slate-700/70 bg-slate-900/70 p-3 font-mono text-xs text-slate-200">
        {latest.length === 0 ? (
          <p className="text-slate-500">Aucun événement.</p>
        ) : (
          <ul className="space-y-1">
            {latest.map((event) => (
              <li key={event.id} className="flex gap-2">
                <span className="text-[0.6rem] text-slate-500">
                  {new Date(event.at).toLocaleTimeString()}
                </span>
                <span>{event.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default JournalFacade;
