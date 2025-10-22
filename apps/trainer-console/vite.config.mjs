import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5301
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0')
  }
});
