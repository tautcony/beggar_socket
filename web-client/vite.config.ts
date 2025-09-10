import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
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
          jimp: ['jimp'],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_debugger: true,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  define: {
    __IS_ELECTRON__: 'false',
  },
});
