import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__VITE_META_ENV__ = (import.meta as any).env ?? {};
}

const bootstrap = async () => {
  const { default: App } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void bootstrap();
