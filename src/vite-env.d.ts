/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Reown project id for AppKit (EVM + Solana) — https://dashboard.reown.com */
  readonly VITE_REOWN_PROJECT_ID?: string
  /** WalletConnect project id for the XRPL client; defaults to the Reown id */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
