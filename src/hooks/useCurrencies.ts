import { useEffect, useMemo, useState } from 'react'
import { fetchCurrencies } from '../lib/api'
import { FEATURED_ORDER, sortTokenCollector } from '../lib/tokens'
import type { BridgeCurrency } from '../types'
import { currencyKey } from '../types'

/**
 * Markets for **XRP out** only (Sell XRP → any asset).
 * From is always XRPL XRP; receive list is all non-XRP cryptos.
 */
export function useCurrencies() {
  const [all, setAll] = useState<BridgeCurrency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await fetchCurrencies()
        if (!cancelled) {
          setAll(sortTokenCollector(list.filter((c) => !c.isFiat)))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load currencies')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Fixed source: XRP on XRPL */
  const xrp = useMemo(
    () => all.find((c) => c.ticker.toLowerCase() === 'xrp' && c.network === 'xrp') ?? null,
    [all],
  )

  /** Destination markets: every crypto except native XRP (keep multi-network tokens). */
  const receiveOptions = useMemo(
    () =>
      sortTokenCollector(
        all.filter((c) => !(c.ticker.toLowerCase() === 'xrp' && c.network === 'xrp')),
      ),
    [all],
  )

  const featuredChips = useMemo(() => {
    const out: BridgeCurrency[] = []
    for (const t of FEATURED_ORDER) {
      if (t === 'xrp') continue
      const hit =
        receiveOptions.find((c) => c.ticker.toLowerCase() === t && c.network === t) ||
        receiveOptions.find((c) => c.ticker.toLowerCase() === t)
      if (hit) out.push(hit)
    }
    return out
  }, [receiveOptions])

  const defaults = useMemo(() => {
    const btc = receiveOptions.find((c) => c.ticker === 'btc' && c.network === 'btc')
    const eth = receiveOptions.find((c) => c.ticker === 'eth' && c.network === 'eth')
    const usdt = receiveOptions.find((c) => c.ticker === 'usdt' && c.network === 'eth')
    return {
      from: xrp,
      to: btc || eth || usdt || featuredChips[0] || null,
    }
  }, [xrp, receiveOptions, featuredChips])

  const byKey = useMemo(() => {
    const map = new Map<string, BridgeCurrency>()
    for (const c of all) map.set(currencyKey(c), c)
    return map
  }, [all])

  return {
    /** Full crypto list (for counts / debug) */
    currencies: all,
    xrp,
    receiveOptions,
    featuredChips,
    byKey,
    defaults,
    loading,
    error,
    count: receiveOptions.length,
  }
}
