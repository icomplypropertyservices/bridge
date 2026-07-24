/**
 * Domain: Sell XRP only (XRP out → any destination asset).
 * No generic from-currency — source is always XRPL XRP.
 */
import type { BridgeCreateResult, BridgeCurrency } from '../types'
import { splitFee, type FeeSplit } from '../lib/fee'

export const SOURCE_TICKER = 'xrp' as const
export const SOURCE_NETWORK = 'xrp' as const

export const SOURCE_LABEL = 'XRP'

/** Fixed source identity for API payloads */
export const SOURCE = {
  ticker: SOURCE_TICKER,
  network: SOURCE_NETWORK,
} as const

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
  to: BridgeCurrency
  fee: FeeSplit
  /** Estimated destination amount for net bridge amount */
  receive: number
  minAmount: number | null
  eta: string | null
  withdrawalFee: number | null
  warning: string | null
  raw: UpstreamEstimate
}

export function buildQuoteView(
  to: BridgeCurrency,
  gross: number,
  feeBps: number,
  raw: UpstreamEstimate,
  minAmount: number | null,
): QuoteView {
  const fee = splitFee(gross, feeBps)
  return {
    to,
    fee,
    receive: Number(raw.toAmount),
    minAmount,
    eta: raw.transactionSpeedForecast ?? null,
    withdrawalFee: raw.withdrawalFee ?? null,
    warning: raw.warningMessage ?? null,
    raw,
  }
}

export function buildCreateBody(args: {
  to: BridgeCurrency
  /** Net XRP after platform cut */
  netXrp: number
  destination: string
}) {
  return {
    fromCurrency: SOURCE_TICKER,
    toCurrency: args.to.ticker,
    fromAmount: args.netXrp,
    address: args.destination,
    fromNetwork: SOURCE_NETWORK,
    toNetwork: args.to.network,
  }
}

export function isXrpSource(c: Pick<BridgeCurrency, 'ticker' | 'network'> | null | undefined): boolean {
  if (!c) return false
  return c.ticker.toLowerCase() === SOURCE_TICKER && c.network === SOURCE_NETWORK
}

export function depositAmount(order: BridgeCreateResult): number {
  return Number(order.directedAmount ?? order.fromAmount)
}
