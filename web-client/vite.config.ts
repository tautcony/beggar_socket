import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-i18n', 'vue-router'],
          sentry: ['@sentry/vue', '@sentry/tracing'],
          luxon: ['luxon'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
  },
});
