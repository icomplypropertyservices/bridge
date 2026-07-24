import type { BridgeCurrency } from '../types'

/** Featured tickers shown first (stable product order). */
export const FEATURED_ORDER = [
  'xrp',
  'btc',
  'eth',
  'usdt',
  'usdc',
  'sol',
  'bnb',
  'trx',
  'ltc',
  'ada',
  'xlm',
  'matic',
] as const

export function tickerKey(c: Pick<BridgeCurrency, 'ticker'>): string {
  return (c.ticker || '').toLowerCase()
}

/** Compare ticker A–Z, then network A–Z, then name. */
export function compareCurrencies(a: BridgeCurrency, b: BridgeCurrency): number {
  const ta = tickerKey(a)
  const tb = tickerKey(b)
  if (ta !== tb) return ta.localeCompare(tb)
  const na = (a.network || '').toLowerCase()
  const nb = (b.network || '').toLowerCase()
  if (na !== nb) return na.localeCompare(nb)
  return (a.name || '').localeCompare(b.name || '')
}

export function featuredRank(ticker: string): number {
  const i = FEATURED_ORDER.indexOf(ticker.toLowerCase() as (typeof FEATURED_ORDER)[number])
  return i === -1 ? 999 : i
}

/**
 * Sort token collector: featured (product order) first, then all others A–Z.
 * Dedupes nothing — multi-network variants stay (ETH eth / ETH bsc, etc.).
 */
export function sortTokenCollector(list: BridgeCurrency[]): BridgeCurrency[] {
  return [...list].sort((a, b) => {
    const fa = a.featured || FEATURED_ORDER.includes(tickerKey(a) as (typeof FEATURED_ORDER)[number])
    const fb = b.featured || FEATURED_ORDER.includes(tickerKey(b) as (typeof FEATURED_ORDER)[number])
    if (fa && !fb) return -1
    if (!fa && fb) return 1
    if (fa && fb) {
      const ra = featuredRank(tickerKey(a))
      const rb = featuredRank(tickerKey(b))
      if (ra !== rb) return ra - rb
    }
    return compareCurrencies(a, b)
  })
}

/** Search-filtered list, always sorted A–Z within results (featured boosted). */
export function sortSearchResults(list: BridgeCurrency[]): BridgeCurrency[] {
  return sortTokenCollector(list)
}
