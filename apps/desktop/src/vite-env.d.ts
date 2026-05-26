/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWNER_PRO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
