import { useEffect, useMemo, useState } from 'react'
import { fetchCurrencies } from '../lib/api'
import { FEATURED_ORDER, sortTokenCollector } from '../lib/tokens'
import type { BridgeCurrency } from '../types'
import { currencyKey } from '../types'

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<BridgeCurrency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await fetchCurrencies()
        if (!cancelled) {
          const nonFiat = list.filter((c) => !c.isFiat)
          setCurrencies(sortTokenCollector(nonFiat))
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

  const featured = useMemo(() => {
    const pool = currencies.filter(
      (c) => c.featured || FEATURED_ORDER.includes(c.ticker.toLowerCase() as (typeof FEATURED_ORDER)[number]),
    )
    return sortTokenCollector(pool)
  }, [currencies])

  const byKey = useMemo(() => {
    const map = new Map<string, BridgeCurrency>()
    for (const c of currencies) map.set(currencyKey(c), c)
    return map
  }, [currencies])

  const defaults = useMemo(() => {
    const xrp = currencies.find((c) => c.ticker === 'xrp' && c.network === 'xrp')
    const usdtTrx = currencies.find((c) => c.ticker === 'usdt' && c.network === 'trx')
    const btc = currencies.find((c) => c.ticker === 'btc' && c.network === 'btc')
    const eth = currencies.find((c) => c.ticker === 'eth' && c.network === 'eth')
    return {
      from: xrp || featured[0] || null,
      to: usdtTrx || btc || eth || featured[1] || null,
    }
  }, [currencies, featured])

  return { currencies, featured, byKey, defaults, loading, error }
}
