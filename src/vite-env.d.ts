/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  // Client ID publico de Brandfetch (viaja dentro de la URL de cada logo, no es un secreto).
  readonly VITE_BRANDFETCH_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
