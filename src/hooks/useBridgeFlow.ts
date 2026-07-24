import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createSellXrpBridge, validateAddress } from '../lib/api'
import { splitFee } from '../lib/fee'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import type { BridgeCreateResult, BridgeCurrency } from '../types'

interface Args {
  to: BridgeCurrency | null
  amount: string
  destination: string
  feeBps: number
  minAmount: number | null
  onCreated: (result: BridgeCreateResult) => void
}

/** Sell XRP execute: fee → create → Xaman deposit deep link. */
export function useBridgeFlow({
  to,
  amount,
  destination,
  feeBps,
  minAmount,
  onCreated,
}: Args) {
  const [creating, setCreating] = useState(false)
  const lock = useRef(false)

  const run = useCallback(async () => {
    if (lock.current || creating) return
    if (!to) {
      toast.error('Select a destination asset')
      return
    }

    const gross = parseFloat(amount)
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error('Enter a valid XRP amount')
      return
    }
    if (!destination.trim()) {
      toast.error('Enter destination address')
      return
    }

    const { fee, net } = splitFee(gross, feeBps)

    if (minAmount != null && net < minAmount) {
      toast.error(
        `Minimum after cut is ~${minAmount} XRP (you enter ${gross}, cut ${fee.toFixed(6)})`,
      )
      return
    }

    lock.current = true
    setCreating(true)
    try {
      const v = await validateAddress({
        currency: to.ticker,
        address: destination.trim(),
        network: to.network,
      })
      if (v.result === false) {
        throw new Error(v.message || `Invalid ${to.ticker.toUpperCase()} destination address`)
      }

      const created = await createSellXrpBridge({
        toCurrency: to.ticker,
        toNetwork: to.network,
        netXrp: net,
        address: destination.trim(),
      })

      if (!created.payinAddress) {
        throw new Error('Bridge created without deposit address')
      }

      onCreated(created)
      toast.success('Bridge order created', {
        description: `Pay ${created.directedAmount ?? net} XRP via Xaman (cut ${fee.toFixed(4)} XRP)`,
      })

      openXamanDeepLink(buildDepositDeepLink(created))
    } catch (e) {
      toast.error('Bridge failed', {
        description: e instanceof Error ? e.message : 'Try again',
      })
    } finally {
      lock.current = false
      setCreating(false)
    }
  }, [amount, creating, destination, feeBps, minAmount, onCreated, to])

  return { creating, run }
}
