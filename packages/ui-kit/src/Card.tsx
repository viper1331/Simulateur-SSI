import type { PropsWithChildren } from 'react';

export const Card = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
    <div className="text-slate-800">{children}</div>
  </div>
);
