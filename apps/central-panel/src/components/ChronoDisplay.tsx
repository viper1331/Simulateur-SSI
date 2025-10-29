import { clsx } from 'clsx';

type ChronoBarProps = {
  label: string;
  total?: number;
  remaining?: number;
  tone: 't1' | 't2';
};

const toneClasses: Record<ChronoBarProps['tone'], string> = {
  t1: 'from-amber-500 to-red-500',
  t2: 'from-sky-500 to-indigo-600'
};

const ChronoBar = ({ label, total, remaining, tone }: ChronoBarProps) => {
  const duration = total ?? 0;
  const rest = remaining ?? 0;
  const elapsed = duration - rest;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-400">
        <span>{label}</span>
        <span className="text-[0.6rem] text-slate-500">
          {remaining !== undefined ? `${remaining}s restant` : 'en attente'}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
        <div
          className={clsx('h-full bg-gradient-to-r transition-all', toneClasses[tone])}
          style={{ width: `${Math.min(100, (elapsed / (duration || 1)) * 100)}%` }}
        />
      </div>
    </div>
  );
};

export type ChronoDisplayProps = {
  t1Initial?: number;
  t2Initial?: number;
  t1Remaining?: number;
  t2Remaining?: number;
  alarmStartedAt?: number;
};

const ChronoDisplay = ({ t1Initial, t2Initial, t1Remaining, t2Remaining, alarmStartedAt }: ChronoDisplayProps) => {
  return (
    <div className="space-y-4">
      <header className="text-xs uppercase tracking-[0.3em] text-slate-400">Chronos T1 / T2</header>
      <ChronoBar label="Temporisation T1" total={t1Initial} remaining={t1Remaining} tone="t1" />
      <ChronoBar label="Temporisation T2" total={t2Initial} remaining={t2Remaining} tone="t2" />
      {alarmStartedAt && (
        <p className="text-xs text-slate-400">
          Alarme lancée à {new Date(alarmStartedAt).toLocaleTimeString()}.
        </p>
      )}
    </div>
  );
};

export default ChronoDisplay;
