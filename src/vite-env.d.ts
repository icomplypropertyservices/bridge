/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Reown project id — used for every WalletConnect surface. https://dashboard.reown.com */
  readonly VITE_REOWN_PROJECT_ID?: string
  /** Optional Solana RPC override; defaults to Reown's Blockchain API */
  readonly VITE_SOLANA_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
