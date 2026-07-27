/**
 * Single AppKit instance for the app (EVM via Wagmi + Solana).
 *
 * `createAppKit` runs once at module scope on purpose — calling it inside a
 * component creates duplicate instances and breaks connection state.
 */
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'
import { APPKIT_NETWORKS } from './networks'

/** Reown's public id — works on localhost only, never on a deployed domain. */
const LOCALHOST_PROJECT_ID = 'b56e18d47c72ab683b10814fe9495694'

const envProjectId = String(import.meta.env.VITE_REOWN_PROJECT_ID || '').trim()

/** False when the deploy has no real project id — surfaced in the connect UI. */
export const walletConnectConfigured = envProjectId.length > 0

/**
 * One Reown project id for everything: AppKit (EVM + Solana), the XRPL
 * WalletConnect client, the wallet-registry lookup and the Solana RPC. Reown
 * *is* WalletConnect, so a second id only adds a way for the two to drift.
 */
export const projectId = envProjectId || LOCALHOST_PROJECT_ID

if (!walletConnectConfigured && typeof window !== 'undefined') {
  console.warn(
    '[riddle-bridge] VITE_REOWN_PROJECT_ID is not set — falling back to Reown’s ' +
      'localhost test id. WalletConnect will fail on any deployed domain. ' +
      'Create a project at https://dashboard.reown.com and set the env var.',
  )
}

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://riddle.bridge'

/** Wallets verify this against the requesting origin — keep it dynamic. */
export const appMetadata = {
  name: 'Riddle Bridge',
  description: 'Cross-chain bridge for the Riddle ecosystem',
  url: origin,
  icons: [`${origin}/logo.jpg`],
}

/** CAIP id for Solana mainnet-beta. */
export const SOLANA_CAIP_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'

/**
 * Explicit Solana RPC. The adapter's default endpoint answers
 * `getLatestBlockhash` with 403 on some networks, which breaks every send, so
 * point it at Reown's Blockchain API (authorised by our project id) unless an
 * override is supplied.
 */
export const solanaRpcUrl =
  String(import.meta.env.VITE_SOLANA_RPC_URL || '').trim() ||
  `https://rpc.walletconnect.org/v1/?chainId=${SOLANA_CAIP_ID}&projectId=${projectId}`

export const wagmiAdapter = new WagmiAdapter({
  networks: APPKIT_NETWORKS,
  projectId,
})

const solanaAdapter = new SolanaAdapter()

export const appKit = createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  networks: APPKIT_NETWORKS,
  projectId,
  metadata: appMetadata,
  customRpcUrls: { [SOLANA_CAIP_ID]: [{ url: solanaRpcUrl }] },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#8b5cf6',
    '--w3m-border-radius-master': '2px',
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    onramp: false,
    swaps: false,
  },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
