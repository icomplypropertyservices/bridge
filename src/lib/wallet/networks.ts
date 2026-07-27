/**
 * Bridge network code (upstream `network` field) → WalletConnect chain identity.
 *
 * Two stacks sit behind one UI:
 * - `eip155` / `solana` → Reown AppKit adapters (Wagmi + Solana)
 * - `xrpl`             → Reown UniversalConnector (Joey Wallet); AppKit has no
 *                        first-party XRPL adapter, so the namespace is custom
 *
 * XRP additionally keeps the Xaman deep-link deposit path — see lib/xaman.
 */
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  linea,
  mainnet,
  optimism,
  polygon,
  solana,
  zksync,
} from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import type { CustomCaipNetwork } from '@reown/appkit-common'

export type WalletFamily = 'eip155' | 'solana' | 'xrpl' | 'stellar'

/** Keys match the upstream network codes mapped in `networkLabel` (lib/format). */
export const EVM_NETWORKS: Record<string, AppKitNetwork> = {
  eth: mainnet,
  bsc,
  matic: polygon,
  arbitrum,
  op: optimism,
  base,
  avaxc: avalanche,
  zksync,
  lna: linea,
}

export const SOLANA_NETWORK_CODES = new Set(['sol'])
export const XRPL_NETWORK_CODES = new Set(['xrp'])
export const STELLAR_NETWORK_CODES = new Set(['xlm'])

export const XRPL_CAIP_NETWORK_ID = 'xrpl:0'
export const XRPL_NAMESPACE = 'xrpl'
export const XRPL_METHODS = ['xrpl_signTransaction', 'xrpl_signTransactionFor']
export const XRPL_EVENTS = ['chainChanged', 'accountsChanged']

/** XRPL mainnet as a WalletConnect CAIP network (Joey Wallet speaks this). */
export const xrplMainnet: CustomCaipNetwork<'xrpl'> = {
  id: '0',
  chainNamespace: 'xrpl' as const,
  caipNetworkId: 'xrpl:0',
  name: 'XRP Ledger',
  nativeCurrency: { name: 'XRP', symbol: 'XRP', decimals: 6 },
  rpcUrls: { default: { http: ['https://xrplcluster.com'] } },
}

const EVM_NETWORK_LIST = Object.values(EVM_NETWORKS)

/**
 * Networks handed to createAppKit — EVM set plus Solana mainnet.
 * Ethereum is pinned first so the tuple is provably non-empty and mainnet is
 * the default selection.
 */
export const APPKIT_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  ...EVM_NETWORK_LIST.filter((n) => n.id !== mainnet.id),
  solana,
]

/** Which wallet stack can sign for this bridge network, if any. */
export function walletFamilyFor(network?: string | null): WalletFamily | null {
  const n = (network || '').toLowerCase()
  if (!n) return null
  if (XRPL_NETWORK_CODES.has(n)) return 'xrpl'
  if (STELLAR_NETWORK_CODES.has(n)) return 'stellar'
  if (SOLANA_NETWORK_CODES.has(n)) return 'solana'
  if (EVM_NETWORKS[n]) return 'eip155'
  return null
}

export function evmChainIdFor(network?: string | null): number | null {
  const chain = EVM_NETWORKS[(network || '').toLowerCase()]
  return typeof chain?.id === 'number' ? chain.id : null
}

/** True when a connected wallet can both hold funds and sign on this network. */
export function isWalletSupported(network?: string | null): boolean {
  return walletFamilyFor(network) !== null
}

export function familyLabel(family: WalletFamily): string {
  if (family === 'eip155') return 'Ethereum / EVM'
  if (family === 'solana') return 'Solana'
  if (family === 'stellar') return 'Stellar'
  return 'XRP Ledger'
}

/** Strip a CAIP account (`eip155:1:0xabc`, `xrpl:0:rXyz`) down to the address. */
export function addressFromCaip(caipAccount?: string | null): string {
  if (!caipAccount) return ''
  const parts = caipAccount.split(':')
  return parts.length >= 3 ? parts.slice(2).join(':') : caipAccount
}
