import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { enginePlugin } from './plugins/engine.js';

export default defineConfig({
  plugins: [react(), enginePlugin()],
});
