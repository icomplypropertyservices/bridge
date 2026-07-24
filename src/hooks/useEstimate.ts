import { useEffect, useState } from 'react'
import { fetchSellXrpEstimate, fetchSellXrpMinAmount } from '../lib/api'
import { splitFee } from '../lib/fee'
import { buildQuoteView, type QuoteView } from '../domain/xrpOut'
import type { BridgeCurrency } from '../types'

/** Quote for Sell XRP → `to`. No generic from-currency. */
export function useEstimate(to: BridgeCurrency | null, amount: string, feeBps: number) {
  const [quote, setQuote] = useState<QuoteView | null>(null)
  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!to) {
      setQuote(null)
      setMinAmount(null)
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      const gross = parseFloat(amount)

      const [minRes, estRes] = await Promise.allSettled([
        fetchSellXrpMinAmount({ toCurrency: to.ticker, toNetwork: to.network }),
        Number.isFinite(gross) && gross > 0
          ? (async () => {
              const { net } = splitFee(gross, feeBps)
              if (net <= 0) return null
              return fetchSellXrpEstimate({
                toCurrency: to.ticker,
                toNetwork: to.network,
                netXrp: net,
              })
            })()
          : Promise.resolve(null),
      ])

      if (cancelled) return

      const min =
        minRes.status === 'fulfilled' ? Number(minRes.value.minAmount) || null : null
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
        setQuote(buildQuoteView(to, gross, feeBps, raw, min))
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
  }, [to, amount, feeBps])

  return { quote, minAmount, loading, error }
}
