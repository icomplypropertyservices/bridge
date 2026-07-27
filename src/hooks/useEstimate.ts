import { useEffect, useState } from 'react'
import { fetchEstimate, fetchMinAmount, type RoutePair } from '../lib/api'
import { splitFee } from '../lib/fee'
import { buildQuoteView, type QuoteView } from '../domain/bridge'
import type { BridgeCurrency } from '../types'

/** Quote for `from` → `to`, debounced, with the platform cut applied first. */
export function useEstimate(
  from: BridgeCurrency | null,
  to: BridgeCurrency | null,
  amount: string,
  feeBps: number,
) {
  const [quote, setQuote] = useState<QuoteView | null>(null)
  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fromKey = from ? `${from.ticker}::${from.network}` : ''
  const toKey = to ? `${to.ticker}::${to.network}` : ''

  useEffect(() => {
    if (!from || !to) {
      setQuote(null)
      setMinAmount(null)
      return
    }

    const route: RoutePair = {
      fromCurrency: from.ticker,
      fromNetwork: from.network,
      toCurrency: to.ticker,
      toNetwork: to.network,
    }

    let cancelled = false
    const t = setTimeout(async () => {
      const gross = parseFloat(amount)

      const [minRes, estRes] = await Promise.allSettled([
        fetchMinAmount(route),
        Number.isFinite(gross) && gross > 0
          ? (async () => {
              const { net } = splitFee(gross, feeBps)
              if (net <= 0) return null
              return fetchEstimate(route, net)
            })()
          : Promise.resolve(null),
      ])

      if (cancelled) return

      const min = minRes.status === 'fulfilled' ? Number(minRes.value.minAmount) || null : null
      setMinAmount(min)

      if (!Number.isFinite(gross) || gross <= 0) {
        setQuote(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        if (estRes.status === 'rejected') throw estRes.reason
        const raw = estRes.value
        if (!raw) {
          setQuote(null)
          setError(null)
          return
        }
        setQuote(buildQuoteView({ from, to, gross, feeBps, raw, minAmount: min }))
        setError(null)
      } catch (e) {
        setQuote(null)
        setError(e instanceof Error ? e.message : 'Estimate failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // `from`/`to` are compared by identity keys so a re-fetched list does not re-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey, amount, feeBps])

  return { quote, minAmount, loading, error }
}
