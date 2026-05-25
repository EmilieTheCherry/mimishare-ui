/// <reference types="vite/client" />
declare module "*.css";

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface ImportMetaEnv {
    readonly VITE_NODE_ENV: string;
    readonly VITE_SIGNALINGSERVER_URL: string;
    readonly VITE_SIGNALINGSERVER_PORT: number;
  }
}
