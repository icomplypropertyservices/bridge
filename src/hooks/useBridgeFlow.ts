import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createBridge, validateAddress } from '../lib/api'
import { feeFromBps, netAfterFee } from '../lib/fee'
import { isXrplNetwork } from '../lib/format'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import type { BridgeCreateResult, BridgeCurrency } from '../types'

interface Args {
  from: BridgeCurrency | null
  to: BridgeCurrency | null
  amount: string
  destination: string
  refundAddress: string
  walletAddress: string
  feeBps: number
  minAmount: number | null
  onCreated: (result: BridgeCreateResult) => void
}

export function useBridgeFlow({
  from,
  to,
  amount,
  destination,
  refundAddress,
  walletAddress,
  feeBps,
  minAmount,
  onCreated,
}: Args) {
  const [creating, setCreating] = useState(false)
  const lock = useRef(false)

  const run = useCallback(async () => {
    if (lock.current || creating) return
    if (!from || !to) {
      toast.error('Select currencies')
      return
    }
    const gross = parseFloat(amount)
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!destination.trim()) {
      toast.error('Enter destination address')
      return
    }

    const bridgeAmount = netAfterFee(gross, feeBps)
    const feeAmt = feeFromBps(gross, feeBps)

    if (minAmount != null && bridgeAmount < minAmount) {
      toast.error(
        `Minimum after fee is ~${minAmount} ${from.ticker.toUpperCase()} (you send ${gross}, fee ${feeAmt.toFixed(6)})`,
      )
      return
    }

    lock.current = true
    setCreating(true)
    try {
      const [v, rv] = await Promise.all([
        validateAddress({
          currency: to.ticker,
          address: destination.trim(),
          network: to.network,
        }),
        refundAddress.trim()
          ? validateAddress({
              currency: from.ticker,
              address: refundAddress.trim(),
              network: from.network,
            })
          : Promise.resolve({ result: true as boolean, message: null }),
      ])
      if (v.result === false) {
        throw new Error(v.message || `Invalid ${to.ticker.toUpperCase()} address`)
      }
      if (rv.result === false) {
        throw new Error(rv.message || 'Invalid refund address')
      }

      const created = await createBridge({
        fromCurrency: from.ticker,
        toCurrency: to.ticker,
        fromAmount: bridgeAmount,
        address: destination.trim(),
        refundAddress: refundAddress.trim() || walletAddress || undefined,
        fromNetwork: from.network,
        toNetwork: to.network,
      })

      onCreated(created)
      toast.success('Bridge order created', {
        description: `Send ${created.directedAmount ?? bridgeAmount} ${from.ticker.toUpperCase()}`,
      })

      // XRPL: open Xaman deep link immediately (user just clicked Bridge)
      if (isXrplNetwork(from.network, from.ticker) && created.payinAddress) {
        openXamanDeepLink(buildDepositDeepLink(created))
      } else {
        toast.message('Send deposit from your wallet', {
          description: 'Copy the deposit address and memo/tag if shown',
        })
      }
    } catch (e) {
      toast.error('Bridge failed', {
        description: e instanceof Error ? e.message : 'Try again',
      })
    } finally {
      lock.current = false
      setCreating(false)
    }
  }, [
    amount,
    creating,
    destination,
    feeBps,
    from,
    minAmount,
    onCreated,
    refundAddress,
    to,
    walletAddress,
  ])

  return { creating, run }
}
