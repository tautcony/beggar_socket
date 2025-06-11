/// <reference types="vite/client" />

/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 扩展 Vite HMR 数据类型
interface ImportMetaHot {
  data: {
    deviceConnection?: {
      connected: boolean;
      port: SerialPort | null;
      reader: ReadableStreamDefaultReader<Uint8Array> | null;
      writer: WritableStreamDefaultWriter<Uint8Array> | null;
    };
  };
}
