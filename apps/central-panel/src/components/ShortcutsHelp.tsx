const entries = [
  { key: 'A', label: 'Acquitter' },
  { key: 'G', label: 'Évacuation générale' },
  { key: 'S', label: 'Arrêt évacuation' },
  { key: 'R', label: 'Réarmement' },
  { key: 'B', label: 'Silence buzzer' },
  { key: 'J', label: 'Ouvrir journal' },
  { key: 'M', label: 'Masquage zone' },
  { key: 'K', label: 'Rotation clef' }
];

const ShortcutsHelp = () => (
  <div className="space-y-3">
    <header className="text-xs uppercase tracking-[0.3em] text-slate-400">Raccourcis clavier</header>
    <ul className="grid grid-cols-2 gap-2 text-xs text-slate-200">
      {entries.map((entry) => (
        <li key={entry.key} className="flex items-center gap-3 rounded-md border border-slate-700/60 bg-slate-900/80 p-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 font-semibold text-indigo-300">
            {entry.key}
          </span>
          <span className="uppercase tracking-widest text-slate-300">{entry.label}</span>
        </li>
      ))}
    </ul>
    <p className="text-[0.65rem] text-slate-500">
      Le mode kiosque peut être activé avec le paramètre <code>?kiosk=1</code>. Appuyez sur ESC pour quitter.
    </p>
  </div>
);

export default ShortcutsHelp;
