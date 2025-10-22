import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export const Button = ({
  children,
  className = '',
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
  <button
    className={`rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);
