import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// 開発: `npm run dev`(Worker :8787) と `npm run dev:web`(画面 :5173) を同時に起動
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
