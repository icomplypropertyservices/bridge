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
import { appMetadata, projectId } from './appkit'
import { focusPeerWallet } from './wcPeer'

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
      projectId,
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

/** How long to wait for the relay to hand back a pairing URI. */
const URI_TIMEOUT_MS = 15000

/**
 * Open a WalletConnect session on `xrpl:0`.
 * `onUri` receives the pairing URI so the caller can render a QR / deep link.
 */
export async function connectXrpl(onUri?: (uri: string) => void): Promise<string> {
  const provider = await Promise.race([
    getXrplProvider(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'WalletConnect relay did not respond. Check that this domain is allowlisted on the Reown project.',
            ),
          ),
        URI_TIMEOUT_MS,
      ),
    ),
  ])

  const existing = xrplAccountFrom(provider.session)
  if (existing) return existing

  let sawUri = false
  const handleUri = (uri: string) => {
    sawUri = true
    onUri?.(uri)
  }
  provider.on('display_uri', handleUri)

  // Without this the modal sits on "waiting for approval" forever when the
  // relay never issues a URI — a silent hang the user cannot act on.
  const uriWatchdog = setTimeout(() => {
    if (!sawUri) {
      provider.events.emit(
        'connect_error',
        new Error('No pairing URI issued — the relay rejected or dropped the request'),
      )
    }
  }, URI_TIMEOUT_MS)

  try {
    const session = await Promise.race([
      provider.connect({
        optionalNamespaces: {
          [XRPL_NAMESPACE]: {
            chains: [XRPL_CAIP_NETWORK_ID],
            methods: XRPL_METHODS,
            events: XRPL_EVENTS,
          },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          if (!sawUri) {
            reject(
              new Error(
                'No QR could be generated — the WalletConnect relay issued no pairing URI. ' +
                  'This usually means this domain is not allowlisted on the Reown project.',
              ),
            )
          }
        }, URI_TIMEOUT_MS),
      ),
    ])

    const account = xrplAccountFrom(session)
    if (!account) throw new Error('Wallet approved the session but returned no XRPL account')
    return account
  } finally {
    clearTimeout(uriWatchdog)
    provider.removeListener('display_uri', handleUri)
  }
}

/**
 * Drop the local WalletConnect store for the XRPL client.
 * A half-written pairing from an interrupted attempt makes every later connect
 * fail; clearing it is the reliable way back to a clean pairing.
 */
export function resetXrplStorage(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) doomed.push(key)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* private mode — nothing cached to clear */
  }
  providerPromise = null
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

  const pending = provider.request(
    {
      method: 'xrpl_signTransaction',
      params: { tx_json, autofill: true, submit: true },
    },
    XRPL_CAIP_NETWORK_ID,
  )
  // Bring the wallet forward, or on mobile the prompt never becomes visible.
  focusPeerWallet(provider.session)

  const res = (await pending) as { tx_json?: Record<string, unknown> } | null

  const signed = res?.tx_json ?? null
  const hash = signed && typeof signed.hash === 'string' ? signed.hash : null
  return { hash, txJson: signed }
}
