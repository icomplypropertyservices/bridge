import { ArrowDownUp, Loader2 } from 'lucide-react'
import { formatAmount, networkLabel } from '../lib/format'
import { feeFromBps, netAfterFee } from '../lib/fee'
import type { BridgeCurrency, BridgeEstimate } from '../types'
import CurrencySelect from './CurrencySelect'

interface Props {
  currencies: BridgeCurrency[]
  from: BridgeCurrency | null
  to: BridgeCurrency | null
  onFrom: (c: BridgeCurrency) => void
  onTo: (c: BridgeCurrency) => void
  onSwapSides: () => void
  amount: string
  onAmount: (v: string) => void
  destination: string
  onDestination: (v: string) => void
  refundAddress: string
  onRefund: (v: string) => void
  estimate: BridgeEstimate | null
  minAmount: number | null
  estimateLoading: boolean
  estimateError: string | null
  feeBps: number
  feePercent: string
  creating: boolean
  onSubmit: () => void
  walletAddress: string
}

export default function BridgeForm({
  currencies,
  from,
  to,
  onFrom,
  onTo,
  onSwapSides,
  amount,
  onAmount,
  destination,
  onDestination,
  refundAddress,
  onRefund,
  estimate,
  minAmount,
  estimateLoading,
  estimateError,
  feeBps,
  feePercent,
  creating,
  onSubmit,
  walletAddress,
}: Props) {
  const gross = parseFloat(amount) || 0
  const feeAmt = feeFromBps(gross, feeBps)
  const bridgeAmt = netAfterFee(gross, feeBps)
  const receive =
    estimate?.netToAmount != null
      ? estimate.netToAmount
      : estimate?.toAmount != null
        ? estimate.toAmount
        : null

  const belowMin = minAmount != null && bridgeAmt > 0 && bridgeAmt < minAmount
  const samePair =
    from && to && from.ticker === to.ticker && from.network === to.network

  return (
    <div className="glass-card p-6 sm:p-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bridge assets</h1>
          <p className="mt-1 text-sm text-riddle-muted">
            Multi-network exchange with Xaman signing for XRPL deposits
          </p>
        </div>
        <span className="chip text-violet-300">Fee {feePercent}%</span>
      </div>

      <div className="space-y-4">
        <CurrencySelect label="You send" value={from} options={currencies} onChange={onFrom} />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSwapSides}
            className="rounded-full border border-riddle-border bg-black/40 p-2.5 text-violet-300 transition hover:bg-violet-500/10"
            aria-label="Swap directions"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <CurrencySelect label="You receive" value={to} options={currencies} onChange={onTo} />

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Amount
          </label>
          <div className="field flex items-center gap-3 !py-4">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-zinc-700"
            />
            <span className="text-sm font-medium text-zinc-400">
              {from?.ticker.toUpperCase() || '—'}
            </span>
          </div>
          {minAmount != null && (
            <p className={`mt-1.5 text-[11px] ${belowMin ? 'text-rose-400' : 'text-riddle-muted'}`}>
              Min after fee: {formatAmount(minAmount)} {from?.ticker.toUpperCase()}
              {belowMin ? ' — increase amount' : ''}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Destination address ({to ? networkLabel(to.network) : 'to network'})
          </label>
          <input
            className="field font-mono text-xs sm:text-sm"
            placeholder="Paste receiving address"
            value={destination}
            onChange={(e) => onDestination(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Refund address (optional)
          </label>
          <input
            className="field font-mono text-xs sm:text-sm"
            placeholder={walletAddress || 'Address for refunds if exchange fails'}
            value={refundAddress}
            onChange={(e) => onRefund(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-riddle-border bg-black/35 p-4 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">You send</span>
            <span>
              {formatAmount(gross)} {from?.ticker.toUpperCase() || ''}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Riddle fee ({feePercent}%)</span>
            <span className="text-amber-300">
              {formatAmount(feeAmt)} {from?.ticker.toUpperCase() || ''}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Bridged amount</span>
            <span>
              {formatAmount(bridgeAmt)} {from?.ticker.toUpperCase() || ''}
            </span>
          </div>
          <div className="mt-1 flex justify-between border-t border-white/5 py-2">
            <span className="text-emerald-400">Est. receive</span>
            <span className="font-semibold">
              {estimateLoading ? (
                <Loader2 className="inline h-4 w-4 animate-spin text-violet-400" />
              ) : receive != null ? (
                `${formatAmount(receive)} ${to?.ticker.toUpperCase() || ''}`
              ) : (
                '—'
              )}
            </span>
          </div>
          {estimate?.transactionSpeedForecast && (
            <div className="flex justify-between py-1 text-[11px] text-riddle-muted">
              <span>ETA</span>
              <span>{estimate.transactionSpeedForecast} min</span>
            </div>
          )}
          {estimate?.withdrawalFee != null && estimate.withdrawalFee > 0 && (
            <div className="flex justify-between py-1 text-[11px] text-riddle-muted">
              <span>Network withdraw fee</span>
              <span>{formatAmount(estimate.withdrawalFee)}</span>
            </div>
          )}
          {estimateError && (
            <p className="mt-2 text-[11px] text-rose-400">{estimateError}</p>
          )}
        </div>

        <button
          type="button"
          className="btn-primary w-full !py-4 text-base"
          disabled={creating || !from || !to || samePair || belowMin || gross <= 0 || !destination.trim()}
          onClick={onSubmit}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating order…
            </>
          ) : (
            `Bridge ${from?.ticker.toUpperCase() || ''} → ${to?.ticker.toUpperCase() || ''}`
          )}
        </button>

        {samePair && (
          <p className="text-center text-xs text-rose-400">Choose different assets or networks</p>
        )}
      </div>
    </div>
  )
}
