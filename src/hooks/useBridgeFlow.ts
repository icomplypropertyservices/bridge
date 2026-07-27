import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createBridge, validateAddress, type RoutePair } from '../lib/api'
import { splitFee } from '../lib/fee'
import { isXrpSource, sameCurrency, depositAmount } from '../domain/bridge'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import { walletFamilyFor } from '../lib/wallet/networks'
import { feeTargetFor, type FeeAddressMap } from '../lib/wallet/feeWallet'
import { saveBridge, patchBridge } from '../lib/history'
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
  refundAddress: string
  feeAddresses: FeeAddressMap | undefined
  onCreated: (result: BridgeCreateResult) => void
  onHistoryChange: () => void
  pay: (order: BridgeCreateResult, from: BridgeCurrency) => Promise<PayResult>
  payFee: (
    from: BridgeCurrency,
    feeAddress: string,
    amount: number | string,
  ) => Promise<PayResult>
  canPay: (from: BridgeCurrency | null) => boolean
}

export type StepState = 'idle' | 'running' | 'done' | 'failed'

/**
 * Create the order, then two payments on the source chain:
 *   step 1 — platform fee to the chain's fee wallet
 *   step 2 — bridge deposit to the order's payin address
 * Step 1 is skipped when no valid fee wallet exists for that chain, in which
 * case the cut stays a deduction and nothing extra is sent.
 */
export function useBridgeFlow({
  from,
  to,
  amount,
  destination,
  feeBps,
  minAmount,
  refundAddress,
  feeAddresses,
  onCreated,
  onHistoryChange,
  pay,
  payFee,
  canPay,
}: Args) {
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState(false)
  const [feeStep, setFeeStep] = useState<StepState>('idle')
  const [depositStep, setDepositStep] = useState<StepState>('idle')
  const lock = useRef(false)

  /** Step 1 — platform fee. Resolves false when the caller should stop. */
  const runFeeStep = useCallback(
    async (order: BridgeCreateResult, source: BridgeCurrency, feeAmount: number) => {
      const target = feeTargetFor(walletFamilyFor(source.network), feeAddresses)
      if (!target || feeAmount <= 0) return true // no fee wallet on this chain

      setFeeStep('running')
      try {
        const { txId } = await payFee(source, target.address, feeAmount)
        patchBridge(order.id, { feeTxId: txId, feeAmount })
        onHistoryChange()
        setFeeStep('done')
        toast.success('Fee sent', { description: shortAddr(txId, 10, 8) })
        return true
      } catch (e) {
        setFeeStep('failed')
        const msg = e instanceof Error ? e.message : 'Try again'
        if (/reject|denied|cancel|user closed/i.test(msg)) toast.info('Fee payment rejected')
        else toast.error('Fee payment failed', { description: msg })
        return false
      }
    },
    [feeAddresses, onHistoryChange, payFee],
  )

  /** Step 2 — the bridge deposit itself. */
  const runDepositStep = useCallback(
    async (order: BridgeCreateResult, source: BridgeCurrency) => {
      setDepositStep('running')
      try {
        const { txId } = await pay(order, source)
        patchBridge(order.id, { depositTxId: txId })
        onHistoryChange()
        setDepositStep('done')
        toast.success('Deposit sent', { description: shortAddr(txId, 10, 8) })
      } catch (e) {
        setDepositStep('failed')
        const msg = e instanceof Error ? e.message : 'Try again'
        if (/reject|denied|cancel|user closed/i.test(msg)) toast.info('Payment rejected in wallet')
        else toast.error('Deposit failed', { description: msg })
      }
    },
    [onHistoryChange, pay],
  )

  /** Execute both payment steps for an already-created order. */
  const payOrder = useCallback(
    async (order: BridgeCreateResult, source: BridgeCurrency, feeAmount: number) => {
      // XRP with no signing session keeps the Xaman deep link — it needs none.
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
        const feeOk = await runFeeStep(order, source, feeAmount)
        if (!feeOk) return
        await runDepositStep(order, source)
      } finally {
        setPaying(false)
      }
    },
    [canPay, runDepositStep, runFeeStep],
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
    setFeeStep('idle')
    setDepositStep('idle')
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

      const refund = refundAddress && walletFamilyFor(from.network) ? refundAddress.trim() : undefined

      const created = await createBridge(route, {
        netAmount: net,
        address: destination.trim(),
        refundAddress: refund,
      })

      if (!created.payinAddress) {
        throw new Error('Bridge created without deposit address')
      }

      saveBridge({
        id: created.id,
        createdAt: Date.now(),
        fromCurrency: created.fromCurrency,
        fromNetwork: created.fromNetwork || from.network,
        toCurrency: created.toCurrency,
        toNetwork: created.toNetwork || to.network,
        amount: depositAmount(created),
        toAmount: Number(created.toAmount),
        payinAddress: created.payinAddress,
        destination: destination.trim(),
        feeAmount: fee,
        status: created.status || 'new',
      })
      onHistoryChange()

      onCreated(created)
      toast.success('Bridge order created', {
        description: `Send ${created.directedAmount ?? net} ${unit} (cut ${fee.toFixed(4)} ${unit})`,
      })

      await payOrder(created, from, fee)
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
    onHistoryChange,
    payOrder,
    refundAddress,
    to,
  ])

  return { creating, paying, feeStep, depositStep, run, payOrder }
}
