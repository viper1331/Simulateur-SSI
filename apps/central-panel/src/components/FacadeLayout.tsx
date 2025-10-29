import { PropsWithChildren, ReactNode } from 'react';
import { clsx } from 'clsx';

export type LedDescriptor = {
  id: string;
  label: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
  active: boolean;
  subtitle?: string;
};

const toneToClass: Record<LedDescriptor['tone'], string> = {
  danger: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]',
  warning: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]',
  info: 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.55)]',
  success: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]'
};

export const Led = ({ descriptor }: { descriptor: LedDescriptor }) => {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-900/60 p-3">
      <span
        aria-hidden
        className={clsx(
          'h-4 w-4 rounded-full border border-slate-600 transition-all',
          descriptor.active ? toneToClass[descriptor.tone] : 'bg-slate-800'
        )}
      />
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
          {descriptor.label}
        </span>
        {descriptor.subtitle && (
          <span className="text-[0.6rem] font-medium uppercase tracking-widest text-slate-400">
            {descriptor.subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export const LedPanel = ({ leds }: { leds: LedDescriptor[] }) => (
  <section
    aria-label="Voyants"
    className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-inner shadow-slate-900/60"
  >
    <header className="mb-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
      Voyants état
    </header>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {leds.map((led) => (
        <Led key={led.id} descriptor={led} />
      ))}
    </div>
  </section>
);

export type FacadeLayoutProps = PropsWithChildren<{
  leds: LedDescriptor[];
  lcd: ReactNode;
  keyboard: ReactNode;
  chronos: ReactNode;
  journal: ReactNode;
  shortcuts: ReactNode;
}>;

const FacadeLayout = ({ leds, lcd, keyboard, chronos, journal, shortcuts }: FacadeLayoutProps) => {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-6">
        <LedPanel leds={leds} />
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-inner shadow-slate-900/60">
          {lcd}
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-inner shadow-slate-900/60">
          {keyboard}
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-inner shadow-slate-900/60">
          {chronos}
        </section>
      </div>
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 shadow-lg shadow-black/40">
          {journal}
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          {shortcuts}
        </section>
      </div>
    </div>
  );
};

export default FacadeLayout;
