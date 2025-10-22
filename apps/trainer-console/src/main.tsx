import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__VITE_META_ENV__ = (import.meta as any).env ?? {};
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
