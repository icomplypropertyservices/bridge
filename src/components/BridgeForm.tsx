import { Loader2 } from 'lucide-react'
import { formatAmount, networkLabel } from '../lib/format'
import { splitFee } from '../lib/fee'
import type { QuoteView } from '../domain/xrpOut'
import type { BridgeCurrency } from '../types'
import CurrencySelect from './CurrencySelect'
import TokenLogo from './TokenLogo'

interface Props {
  receiveOptions: BridgeCurrency[]
  featuredChips: BridgeCurrency[]
  xrpImage?: string | null
  to: BridgeCurrency | null
  onTo: (c: BridgeCurrency) => void
  amount: string
  onAmount: (v: string) => void
  destination: string
  onDestination: (v: string) => void
  quote: QuoteView | null
  minAmount: number | null
  estimateLoading: boolean
  estimateError: string | null
  feeBps: number
  feePercent: string
  creating: boolean
  onSubmit: () => void
}

/** Sell XRP only — platform cut reduces deposit size (not a separate fee-wallet tx). */
export default function BridgeForm({
  receiveOptions,
  featuredChips,
  xrpImage,
  to,
  onTo,
  amount,
  onAmount,
  destination,
  onDestination,
  quote,
  minAmount,
  estimateLoading,
  estimateError,
  feeBps,
  feePercent,
  creating,
  onSubmit,
}: Props) {
  const gross = parseFloat(amount) || 0
  const { fee: feeAmt, net: bridgeAmt } = splitFee(gross, feeBps)
  const receive = quote?.receive ?? null
  const belowMin = minAmount != null && bridgeAmt > 0 && bridgeAmt < minAmount
  const canSubmit =
    Boolean(to) && !creating && !belowMin && gross > 0 && destination.trim().length > 0

  return (
    <div className="glass-card p-6 sm:p-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Sell XRP</h1>
          <p className="mt-1 text-sm text-riddle-muted">
            XRP out → {receiveOptions.length.toLocaleString()}+ assets · Xaman deposit
          </p>
        </div>
        <span className="chip text-violet-300">Cut {feePercent}%</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            You send
          </div>
          <div className="field flex items-center gap-3 !py-3">
            <TokenLogo ticker="xrp" image={xrpImage} size={32} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">XRP</div>
              <div className="text-[11px] text-riddle-muted">Ripple · XRPL (fixed)</div>
            </div>
            <span className="chip text-emerald-300/90">XRP out</span>
          </div>
        </div>

        <CurrencySelect
          label="You receive"
          value={to}
          options={receiveOptions}
          onChange={onTo}
          chips={featuredChips}
          totalCount={receiveOptions.length}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Amount (XRP)
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
            <span className="text-sm font-medium text-zinc-400">XRP</span>
          </div>
          {minAmount != null && (
            <p className={`mt-1.5 text-[11px] ${belowMin ? 'text-rose-400' : 'text-riddle-muted'}`}>
              Min deposit after cut: {formatAmount(minAmount)} XRP
              {belowMin ? ' — increase amount' : ''}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Destination (
            {to ? `${to.ticker.toUpperCase()} · ${networkLabel(to.network)}` : 'receive network'})
          </label>
          <input
            className="field font-mono text-xs sm:text-sm"
            placeholder="Paste receiving address"
            value={destination}
            onChange={(e) => onDestination(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-riddle-border bg-black/35 p-4 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">You enter</span>
            <span>{formatAmount(gross)} XRP</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Platform cut ({feePercent}%)</span>
            <span className="text-amber-300">{formatAmount(feeAmt)} XRP</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Deposit amount (bridged)</span>
            <span className="font-medium text-violet-200">{formatAmount(bridgeAmt)} XRP</span>
          </div>
          <p className="pt-1 text-[10px] text-zinc-600">
            Cut reduces deposit size — not a separate fee wallet payment.
          </p>
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
          {quote?.eta && (
            <div className="flex justify-between py-1 text-[11px] text-riddle-muted">
              <span>ETA</span>
              <span>{quote.eta} min</span>
            </div>
          )}
          {quote?.withdrawalFee != null && quote.withdrawalFee > 0 && (
            <div className="flex justify-between py-1 text-[11px] text-riddle-muted">
              <span>Network withdraw fee</span>
              <span>{formatAmount(quote.withdrawalFee)}</span>
            </div>
          )}
          {estimateError && <p className="mt-2 text-[11px] text-rose-400">{estimateError}</p>}
        </div>

        <button
          type="button"
          className="btn-primary w-full !py-4 text-base"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating & opening Xaman…
            </>
          ) : (
            `Sell XRP → ${to?.ticker.toUpperCase() || '…'}`
          )}
        </button>

        <p className="text-center text-[11px] text-riddle-muted">
          Create uses net XRP · Xaman opens to execute the deposit
        </p>
      </div>
    </div>
  )
}
