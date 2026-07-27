/**
 * Stellar over WalletConnect — LOBSTR and other WC v2 Stellar wallets.
 *
 * Same shape as the XRPL client: AppKit ships no Stellar adapter, so this is a
 * dedicated UniversalProvider on the `stellar` namespace with its own storage
 * prefix, keeping its session clear of AppKit's and the XRPL one's.
 *
 * `stellar_signAndSubmitXDR` returns only `{ status }`, never a hash, so the
 * transaction hash is computed locally from the envelope we built.
 */
import { UniversalProvider } from '@walletconnect/universal-provider'
import type { SessionTypes } from '@walletconnect/types'
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { addressFromCaip } from './networks'
import { appMetadata, projectId } from './appkit'
import { focusPeerWallet } from './wcPeer'

const STORAGE_PREFIX = 'riddle-stellar'
const URI_TIMEOUT_MS = 15000

export const STELLAR_NAMESPACE = 'stellar'
export const STELLAR_CAIP_NETWORK_ID = 'stellar:pubnet'
export const STELLAR_METHODS = ['stellar_signAndSubmitXDR', 'stellar_signXDR']
export const STELLAR_EVENTS: string[] = []

const HORIZON_URL =
  String(import.meta.env.VITE_STELLAR_HORIZON_URL || '').trim() || 'https://horizon.stellar.org'

type Provider = Awaited<ReturnType<typeof UniversalProvider.init>>

let providerPromise: Promise<Provider> | null = null

export function getStellarProvider(): Promise<Provider> {
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

export function stellarAccountFrom(session?: SessionTypes.Struct | null): string {
  const account = session?.namespaces?.[STELLAR_NAMESPACE]?.accounts?.[0]
  return addressFromCaip(account)
}

export async function restoreStellarSession(): Promise<string> {
  try {
    const provider = await getStellarProvider()
    return stellarAccountFrom(provider.session)
  } catch {
    return ''
  }
}

export async function connectStellar(onUri?: (uri: string) => void): Promise<string> {
  const provider = await getStellarProvider()

  const existing = stellarAccountFrom(provider.session)
  if (existing) return existing

  let sawUri = false
  const handleUri = (uri: string) => {
    sawUri = true
    onUri?.(uri)
  }
  provider.on('display_uri', handleUri)

  try {
    const session = await Promise.race([
      provider.connect({
        optionalNamespaces: {
          [STELLAR_NAMESPACE]: {
            chains: [STELLAR_CAIP_NETWORK_ID],
            methods: STELLAR_METHODS,
            events: STELLAR_EVENTS,
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

    const account = stellarAccountFrom(session)
    if (!account) throw new Error('Wallet approved the session but returned no Stellar account')
    return account
  } finally {
    provider.removeListener('display_uri', handleUri)
  }
}

export async function disconnectStellar(): Promise<void> {
  try {
    const provider = await getStellarProvider()
    if (provider.session) await provider.disconnect()
  } catch {
    /* already gone upstream — local state is cleared by the caller */
  }
}

export function resetStellarStorage(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) doomed.push(key)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* private mode */
  }
  providerPromise = null
}

/** Stellar amounts are decimal strings with at most 7 places. */
export function toStellarAmount(amount: number | string): string {
  const [whole, frac = ''] = String(amount).trim().split('.')
  const w = whole || '0'
  if (!/^\d+$/.test(w)) throw new Error(`Invalid Stellar amount: ${amount}`)
  const f = frac.replace(/\D/g, '').slice(0, 7).replace(/0+$/, '')
  return f ? `${w}.${f}` : w
}

/**
 * `tokenContract` for Stellar assets is `CODE:ISSUER`; anything else is native
 * XLM. Getting this wrong sends the wrong asset, so it is parsed strictly.
 */
export function parseStellarAsset(tokenContract?: string | null): Asset {
  const raw = (tokenContract || '').trim()
  if (!raw) return Asset.native()
  const [code, issuer] = raw.split(/[:\-]/)
  if (!code || !issuer) throw new Error(`Unrecognised Stellar asset: ${raw}`)
  return new Asset(code, issuer)
}

export interface StellarPaymentArgs {
  from: string
  destination: string
  amount: number | string
  /** Exchange deposit tag — Stellar carries it as a transaction memo */
  memo?: string | null
  tokenContract?: string | null
}

export interface StellarSubmitResult {
  hash: string
  status: string
}

/**
 * Build, sign and submit a Stellar payment through the connected wallet.
 *
 * The memo is written as MEMO_TEXT, which is what deposit routes on this
 * upstream use. A Stellar deposit without its memo is unattributable, so the
 * transaction is refused outright rather than sent unlabelled when the order
 * carries a tag we cannot encode.
 */
export async function payStellar(args: StellarPaymentArgs): Promise<StellarSubmitResult> {
  const provider = await getStellarProvider()
  if (!provider.session) throw new Error('Stellar wallet is not connected')

  const server = new Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(args.from)

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  }).addOperation(
    Operation.payment({
      destination: args.destination.trim(),
      asset: parseStellarAsset(args.tokenContract),
      amount: toStellarAmount(args.amount),
    }),
  )

  const memo = (args.memo || '').trim()
  if (memo) {
    if (memo.length > 28) {
      throw new Error(`Deposit memo is too long for a Stellar text memo: ${memo}`)
    }
    builder.addMemo(Memo.text(memo))
  }

  const tx = builder.setTimeout(180).build()
  const hash = tx.hash().toString('hex')

  const pending = provider.request(
    { method: 'stellar_signAndSubmitXDR', params: { xdr: tx.toXDR() } },
    STELLAR_CAIP_NETWORK_ID,
  )
  focusPeerWallet(provider.session)

  const res = (await pending) as { status?: string } | null
  const status = res?.status || 'unknown'
  if (status !== 'success' && status !== 'pending') {
    throw new Error(`Wallet returned status "${status}"`)
  }

  return { hash, status }
}
