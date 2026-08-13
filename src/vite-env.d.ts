/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ITUNES_BASE?: string;
  readonly VITE_ITUNES_COUNTRY?: string;
  readonly VITE_YOUTUBE_KEY?: string;
  readonly VITE_WORKER_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
