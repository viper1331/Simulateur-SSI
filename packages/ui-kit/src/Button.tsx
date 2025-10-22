import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export const Button = ({
  children,
  className = '',
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
  <button
    className={`min-h-[44px] rounded-md border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99] touch-manipulation disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);
