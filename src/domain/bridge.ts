/**
 * Bridge domain — any source asset → any destination asset.
 *
 * Supersedes the XRP-only domain. XRP stays the default source (and keeps its
 * Xaman deep-link deposit path), but a connected EVM or Solana wallet can now
 * fund the deposit directly, so the source side is no longer fixed.
 */
import type { BridgeCreateResult, BridgeCurrency } from '../types'
import { splitFee, type FeeSplit } from '../lib/fee'

/** Default source: XRP on the XRP Ledger. */
export const SOURCE_TICKER = 'xrp' as const
export const SOURCE_NETWORK = 'xrp' as const

/** Upstream wire estimate (do not mutate for UI) */
export type UpstreamEstimate = {
  fromCurrency?: string
  fromNetwork?: string
  toCurrency?: string
  toNetwork?: string
  fromAmount: number
  toAmount: number
  depositFee?: number
  withdrawalFee?: number
  transactionSpeedForecast?: string | null
  warningMessage?: string | null
  flow?: string
  type?: string
}

/** UI quote view — fee as net markup (not a separate fee wallet collection). */
export type QuoteView = {
  from: BridgeCurrency
  to: BridgeCurrency
  fee: FeeSplit
  /** Estimated destination amount for the net bridge amount */
  receive: number
  minAmount: number | null
  eta: string | null
  withdrawalFee: number | null
  warning: string | null
  raw: UpstreamEstimate
}

export function buildQuoteView(args: {
  from: BridgeCurrency
  to: BridgeCurrency
  gross: number
  feeBps: number
  raw: UpstreamEstimate
  minAmount: number | null
}): QuoteView {
  return {
    from: args.from,
    to: args.to,
    fee: splitFee(args.gross, args.feeBps),
    receive: Number(args.raw.toAmount),
    minAmount: args.minAmount,
    eta: args.raw.transactionSpeedForecast ?? null,
    withdrawalFee: args.raw.withdrawalFee ?? null,
    warning: args.raw.warningMessage ?? null,
    raw: args.raw,
  }
}

export function isXrpSource(
  c: Pick<BridgeCurrency, 'ticker' | 'network'> | null | undefined,
): boolean {
  if (!c) return false
  return c.ticker.toLowerCase() === SOURCE_TICKER && c.network === SOURCE_NETWORK
}

export function sameCurrency(
  a: Pick<BridgeCurrency, 'ticker' | 'network'> | null | undefined,
  b: Pick<BridgeCurrency, 'ticker' | 'network'> | null | undefined,
): boolean {
  if (!a || !b) return false
  return a.ticker.toLowerCase() === b.ticker.toLowerCase() && a.network === b.network
}

/** Exact amount the user must send, as directed by the upstream order. */
export function depositAmount(order: BridgeCreateResult): number {
  return Number(order.directedAmount ?? order.fromAmount)
}

/** Destination tag / memo attached to the deposit, when the route needs one. */
export function depositTag(order: BridgeCreateResult): string | null {
  const raw = order.payinExtraId
  if (raw == null) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}
