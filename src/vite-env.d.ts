/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_PWA_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
