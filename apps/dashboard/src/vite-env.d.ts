/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENGINE_URL?: string;
  readonly VITE_INSIGHT_URL?: string;
  readonly VITE_DEFAULT_API_KEY?: string;
  readonly VITE_DEFAULT_ADMIN_KEY?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
