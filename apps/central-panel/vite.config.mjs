import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return defineConfig({
    plugins: [react()],
    define: {
      __VITE_META_ENV__: env
    },
    server: {
      host: '0.0.0.0'
    }
  });
};
