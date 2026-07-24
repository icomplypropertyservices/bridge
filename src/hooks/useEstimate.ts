import { useEffect, useState } from 'react'
import { fetchEstimate, fetchMinAmount } from '../lib/api'
import { feeFromBps, netAfterFee } from '../lib/fee'
import type { BridgeCurrency, BridgeEstimate } from '../types'

export function useEstimate(
  from: BridgeCurrency | null,
  to: BridgeCurrency | null,
  amount: string,
  feeBps: number,
) {
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null)
  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) {
      setEstimate(null)
      setMinAmount(null)
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const min = await fetchMinAmount({
          fromCurrency: from.ticker,
          toCurrency: to.ticker,
          fromNetwork: from.network,
          toNetwork: to.network,
        })
        if (!cancelled) setMinAmount(Number(min.minAmount) || null)
      } catch {
        if (!cancelled) setMinAmount(null)
      }

      const gross = parseFloat(amount)
      if (!Number.isFinite(gross) || gross <= 0) {
        if (!cancelled) {
          setEstimate(null)
          setError(null)
          setLoading(false)
        }
        return
      }

      // Quote the net (post-fee) amount so estimate matches create payload
      const bridgeAmt = netAfterFee(gross, feeBps)
      if (bridgeAmt <= 0) {
        if (!cancelled) {
          setEstimate(null)
          setError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const data = await fetchEstimate({
          fromCurrency: from.ticker,
          toCurrency: to.ticker,
          fromAmount: bridgeAmt,
          fromNetwork: from.network,
          toNetwork: to.network,
        })
        if (!cancelled) {
          // Quote is for net (post-fee) amount; attach fee metadata for the UI
          setEstimate({
            ...data,
            fromAmount: gross,
            platformFeeAmount: feeFromBps(gross, feeBps),
            platformFeeBps: feeBps,
            bridgeAmount: bridgeAmt,
            netToAmount: Number(data.toAmount),
            toAmount: Number(data.toAmount),
          })
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setEstimate(null)
          setError(e instanceof Error ? e.message : 'Estimate failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [from, to, amount, feeBps])

  return { estimate, minAmount, loading, error }
}
