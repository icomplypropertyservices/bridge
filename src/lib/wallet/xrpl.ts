/**
 * XRPL over WalletConnect — Joey Wallet.
 *
 * AppKit has no first-party XRPL adapter, so this drives a dedicated
 * UniversalProvider on the `xrpl` namespace. It is deliberately a *second*
 * WalletConnect client from AppKit's, isolated by `customStoragePrefix` so the
 * two sessions never overwrite each other in localStorage.
 *
 * Xaman is untouched by this — it keeps its deep-link path in lib/xaman.
 */
// Named export, not default — the default is not the class under Node's CJS
// interop, and relying on the bundler to paper over that is fragile.
import { UniversalProvider } from '@walletconnect/universal-provider'
import type { SessionTypes } from '@walletconnect/types'
import {
  XRPL_CAIP_NETWORK_ID,
  XRPL_EVENTS,
  XRPL_METHODS,
  XRPL_NAMESPACE,
  addressFromCaip,
} from './networks'
import { appMetadata, wcProjectId } from './appkit'

const STORAGE_PREFIX = 'riddle-xrpl'

export interface XrplPaymentArgs {
  from: string
  destination: string
  /** Decimal XRP, e.g. 49.5754 */
  amountXrp: number | string
  destinationTag?: string | number | null
}

export interface XrplSubmitResult {
  hash: string | null
  txJson: Record<string, unknown> | null
}

type Provider = Awaited<ReturnType<typeof UniversalProvider.init>>

let providerPromise: Promise<Provider> | null = null

export function getXrplProvider(): Promise<Provider> {
  if (!providerPromise) {
    providerPromise = UniversalProvider.init({
      projectId: wcProjectId,
      metadata: appMetadata,
      customStoragePrefix: STORAGE_PREFIX,
    }).catch((e) => {
      providerPromise = null
      throw e
    })
  }
  return providerPromise
}

/** First XRPL account on a session, or '' when the session has none. */
export function xrplAccountFrom(session?: SessionTypes.Struct | null): string {
  const account = session?.namespaces?.[XRPL_NAMESPACE]?.accounts?.[0]
  return addressFromCaip(account)
}

/** Address from an already-restored session — no network call, no prompt. */
export async function restoreXrplSession(): Promise<string> {
  try {
    const provider = await getXrplProvider()
    return xrplAccountFrom(provider.session)
  } catch {
    return ''
  }
}

/**
 * Open a WalletConnect session on `xrpl:0`.
 * `onUri` receives the pairing URI so the caller can render a QR / deep link.
 */
export async function connectXrpl(onUri?: (uri: string) => void): Promise<string> {
  const provider = await getXrplProvider()

  const existing = xrplAccountFrom(provider.session)
  if (existing) return existing

  const handleUri = (uri: string) => onUri?.(uri)
  provider.on('display_uri', handleUri)

  try {
    const session = await provider.connect({
      optionalNamespaces: {
        [XRPL_NAMESPACE]: {
          chains: [XRPL_CAIP_NETWORK_ID],
          methods: XRPL_METHODS,
          events: XRPL_EVENTS,
        },
      },
    })

    const account = xrplAccountFrom(session)
    if (!account) throw new Error('Wallet approved the session but returned no XRPL account')
    return account
  } finally {
    provider.removeListener('display_uri', handleUri)
  }
}

export async function disconnectXrpl(): Promise<void> {
  try {
    const provider = await getXrplProvider()
    if (provider.session) await provider.disconnect()
  } catch {
    /* session already gone upstream — local state is cleared by the caller */
  }
}

/** Decimal XRP → integer drops string, without float drift. */
export function xrpToDrops(amount: number | string): string {
  const [whole, frac = ''] = String(amount).trim().split('.')
  const drops = `${whole || '0'}${frac.padEnd(6, '0').slice(0, 6)}`.replace(/^0+(?=\d)/, '')
  if (!/^\d+$/.test(drops)) throw new Error(`Invalid XRP amount: ${amount}`)
  return drops
}

/**
 * Sign + submit a Payment. `autofill` and `submit` both default to true in the
 * XRPL RPC spec, but they are sent explicitly so behaviour does not drift.
 */
export async function payXrpl(args: XrplPaymentArgs): Promise<XrplSubmitResult> {
  const provider = await getXrplProvider()
  if (!provider.session) throw new Error('XRPL wallet is not connected')

  const tag =
    args.destinationTag != null && String(args.destinationTag).trim() !== ''
      ? Number(args.destinationTag)
      : null
  if (tag != null && !Number.isInteger(tag)) {
    throw new Error(`Invalid destination tag: ${args.destinationTag}`)
  }

  const tx_json: Record<string, unknown> = {
    TransactionType: 'Payment',
    Account: args.from,
    Destination: args.destination,
    Amount: xrpToDrops(args.amountXrp),
  }
  if (tag != null) tx_json.DestinationTag = tag

  const res = (await provider.request(
    {
      method: 'xrpl_signTransaction',
      params: { tx_json, autofill: true, submit: true },
    },
    XRPL_CAIP_NETWORK_ID,
  )) as { tx_json?: Record<string, unknown> } | null

  const signed = res?.tx_json ?? null
  const hash = signed && typeof signed.hash === 'string' ? signed.hash : null
  return { hash, txJson: signed }
}
