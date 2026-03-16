import { execSync } from 'child_process';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';

function readGitValue(command: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

const buildBranch = (
  firstNonEmpty(
    // Cloudflare Pages
    process.env.CF_PAGES_BRANCH,
    // GitHub Actions
    process.env.GITHUB_REF_NAME,
    process.env.GITHUB_HEAD_REF,
    // GitLab CI / other CI
    process.env.CI_COMMIT_REF_NAME,
    process.env.BRANCH_NAME,
    // Local fallback
    readGitValue('git rev-parse --abbrev-ref HEAD'),
  )
);

const buildCommit = (
  firstNonEmpty(
    // Cloudflare Pages
    process.env.CF_PAGES_COMMIT_SHA,
    // GitHub Actions
    process.env.GITHUB_SHA,
    // GitLab CI / other CI
    process.env.CI_COMMIT_SHA,
    // Local fallback
    readGitValue('git rev-parse HEAD'),
  )
);

const isReleaseBuild = buildBranch === 'main';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  define: {
    __IS_ELECTRON__: 'false',
    global: 'globalThis',
    'import.meta.env.VITE_BUILD_BRANCH': JSON.stringify(buildBranch),
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(buildCommit),
    'import.meta.env.VITE_BUILD_IS_RELEASE': JSON.stringify(String(isReleaseBuild)),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      buffer: 'buffer',
    },
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  },
  build: {
    sourcemap: true,
    minify: 'terser',
    cssCodeSplit: true,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/vue-i18n/') || id.includes('/node_modules/vue-router/')) {
            return 'vue';
          }

          if (id.includes('/node_modules/@sentry/vue/') || id.includes('/node_modules/@sentry/tracing/')) {
            return 'sentry';
          }

          if (id.includes('/node_modules/luxon/')) {
            return 'luxon';
          }

          if (id.includes('/node_modules/jimp/')) {
            return 'jimp';
          }
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
});
