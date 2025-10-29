export type LcdDisplayProps = {
  lines: string[];
  statusLine?: string;
};

const LcdDisplay = ({ lines, statusLine }: LcdDisplayProps) => {
  const normalized = lines.length > 0 ? lines : ['SYSTEME PRET'];
  return (
    <div className="space-y-2">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>Afficheur LCD</span>
        {statusLine && <span className="text-[0.55rem] text-slate-500">{statusLine}</span>}
      </header>
      <div
        className="rounded-lg border border-emerald-400/60 bg-emerald-900/30 p-4 font-mono text-sm text-emerald-100 shadow-inner shadow-emerald-500/20"
        role="status"
        aria-live="polite"
      >
        <pre className="whitespace-pre-wrap leading-relaxed">{normalized.join('\n')}</pre>
      </div>
    </div>
  );
};

export default LcdDisplay;
