interface IndicatorProps {
  label: string;
  active?: boolean;
  tone?: 'danger' | 'warning' | 'ok';
}

const toneClasses: Record<Required<IndicatorProps>['tone'], string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  ok: 'bg-emerald-500'
};

export const Indicator = ({ label, active = false, tone = 'ok' }: IndicatorProps) => (
  <div className="flex items-center gap-2">
    <span
      className={`h-3 w-3 rounded-full border border-slate-300 transition-colors ${
        active ? toneClasses[tone] : 'bg-slate-200'
      }`}
    />
    <span className="text-xs font-medium text-slate-700">{label}</span>
  </div>
);
