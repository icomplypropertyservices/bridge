import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createBridge, validateAddress, type RoutePair } from '../lib/api'
import { splitFee } from '../lib/fee'
import { isXrpSource, sameCurrency } from '../domain/bridge'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import { walletFamilyFor } from '../lib/wallet/networks'
import { shortAddr } from '../lib/format'
import type { BridgeCreateResult, BridgeCurrency } from '../types'
import type { PayResult } from './usePayDeposit'

interface Args {
  from: BridgeCurrency | null
  to: BridgeCurrency | null
  amount: string
  destination: string
  feeBps: number
  minAmount: number | null
  /** Source wallet address, sent as refund target when known */
  refundAddress: string
  onCreated: (result: BridgeCreateResult) => void
  pay: (order: BridgeCreateResult, from: BridgeCurrency) => Promise<PayResult>
  canPay: (from: BridgeCurrency | null) => boolean
}

/** Create the order, then hand the deposit to the wallet that can sign it. */
export function useBridgeFlow({
  from,
  to,
  amount,
  destination,
  feeBps,
  minAmount,
  refundAddress,
  onCreated,
  pay,
  canPay,
}: Args) {
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState(false)
  const lock = useRef(false)

  /** Execute the deposit for an already-created order. */
  const payOrder = useCallback(
    async (order: BridgeCreateResult, source: BridgeCurrency) => {
      // XRP with no connected wallet keeps the Xaman deep link — it needs no session.
      if (isXrpSource(source) && !canPay(source)) {
        openXamanDeepLink(buildDepositDeepLink(order))
        return
      }

      if (!canPay(source)) {
        toast.info('Send the deposit manually', {
          description: `Use the address and exact amount shown for ${source.ticker.toUpperCase()}`,
        })
        return
      }

      setPaying(true)
      try {
        const { txId } = await pay(order, source)
        toast.success('Deposit sent', { description: shortAddr(txId, 10, 8) })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Try again'
        if (/reject|denied|cancel|user closed/i.test(msg)) {
          toast.info('Payment rejected in wallet')
        } else {
          toast.error('Deposit failed', { description: msg })
        }
      } finally {
        setPaying(false)
      }
    },
    [canPay, pay],
  )

  const run = useCallback(async () => {
    if (lock.current || creating) return
    if (!from) {
      toast.error('Select the asset you are sending')
      return
    }
    if (!to) {
      toast.error('Select a destination asset')
      return
    }
    if (sameCurrency(from, to)) {
      toast.error('Send and receive assets must differ')
      return
    }

    const gross = parseFloat(amount)
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error(`Enter a valid ${from.ticker.toUpperCase()} amount`)
      return
    }
    if (!destination.trim()) {
      toast.error('Enter destination address')
      return
    }

    const { fee, net } = splitFee(gross, feeBps)
    const unit = from.ticker.toUpperCase()

    if (minAmount != null && net < minAmount) {
      toast.error(
        `Minimum after cut is ~${minAmount} ${unit} (you enter ${gross}, cut ${fee.toFixed(6)})`,
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

      const route: RoutePair = {
        fromCurrency: from.ticker,
        fromNetwork: from.network,
        toCurrency: to.ticker,
        toNetwork: to.network,
      }

      // Only send a refund address the source chain would actually accept.
      const refund =
        refundAddress && walletFamilyFor(from.network) ? refundAddress.trim() : undefined

      const created = await createBridge(route, {
        netAmount: net,
        address: destination.trim(),
        refundAddress: refund,
      })

      if (!created.payinAddress) {
        throw new Error('Bridge created without deposit address')
      }

      onCreated(created)
      toast.success('Bridge order created', {
        description: `Send ${created.directedAmount ?? net} ${unit} (cut ${fee.toFixed(4)} ${unit})`,
      })

      await payOrder(created, from)
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
    payOrder,
    refundAddress,
    to,
  ])

  return { creating, paying, run, payOrder }
}
