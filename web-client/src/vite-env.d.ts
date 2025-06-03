/// <reference types="vite/client" />

/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface Window {
    showToast?: (msg: string, type?: 'success' | 'error' | 'idle', duration?: number) => void;
  }
}
