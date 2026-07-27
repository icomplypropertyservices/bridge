import { useEffect, useMemo, useState } from 'react'
import { fetchCurrencies } from '../lib/api'
import { FEATURED_ORDER, sortTokenCollector } from '../lib/tokens'
import { SOURCE_NETWORK, SOURCE_TICKER } from '../domain/bridge'
import type { BridgeCurrency } from '../types'
import { currencyKey } from '../types'

/**
 * Markets for both sides of the bridge. XRP remains the default source, but any
 * listed asset can be sent — a connected wallet signs it where the network is
 * supported, otherwise the user sends manually to the deposit address.
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

  const xrp = useMemo(
    () =>
      all.find((c) => c.ticker.toLowerCase() === SOURCE_TICKER && c.network === SOURCE_NETWORK) ??
      null,
    [all],
  )

  /** Both selectors draw from the same market list. */
  const options = useMemo(() => sortTokenCollector(all), [all])

  const featuredChips = useMemo(() => {
    const out: BridgeCurrency[] = []
    for (const t of FEATURED_ORDER) {
      const hit =
        options.find((c) => c.ticker.toLowerCase() === t && c.network === t) ||
        options.find((c) => c.ticker.toLowerCase() === t)
      if (hit) out.push(hit)
    }
    return out
  }, [options])

  const defaults = useMemo(() => {
    const btc = options.find((c) => c.ticker === 'btc' && c.network === 'btc')
    const eth = options.find((c) => c.ticker === 'eth' && c.network === 'eth')
    const usdt = options.find((c) => c.ticker === 'usdt' && c.network === 'eth')
    return {
      from: xrp ?? eth ?? options[0] ?? null,
      to: btc || eth || usdt || featuredChips[0] || null,
    }
  }, [xrp, options, featuredChips])

  const byKey = useMemo(() => {
    const map = new Map<string, BridgeCurrency>()
    for (const c of all) map.set(currencyKey(c), c)
    return map
  }, [all])

  return {
    currencies: all,
    xrp,
    options,
    featuredChips,
    byKey,
    defaults,
    loading,
    error,
    count: options.length,
  }
}
