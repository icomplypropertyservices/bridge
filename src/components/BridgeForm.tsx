import { ArrowDownUp, Loader2, Wallet } from 'lucide-react'
import { formatAmount, networkLabel, shortAddr } from '../lib/format'
import { splitFee } from '../lib/fee'
import { isXrpSource, type QuoteView } from '../domain/bridge'
import { walletFamilyFor } from '../lib/wallet/networks'
import type { BridgeCurrency } from '../types'
import CurrencySelect from './CurrencySelect'

interface Props {
  options: BridgeCurrency[]
  featuredChips: BridgeCurrency[]
  from: BridgeCurrency | null
  onFrom: (c: BridgeCurrency) => void
  to: BridgeCurrency | null
  onTo: (c: BridgeCurrency) => void
  onSwap: () => void
  amount: string
  onAmount: (v: string) => void
  destination: string
  onDestination: (v: string) => void
  /** Connected address that can receive on the destination network, if any */
  destinationWallet: string
  /** Connected address that can fund the deposit, if any */
  sourceWallet: string
  quote: QuoteView | null
  minAmount: number | null
  estimateLoading: boolean
  estimateError: string | null
  feeBps: number
  feePercent: string
  creating: boolean
  paying: boolean
  onSubmit: () => void
  onConnectSource: () => void
}

export default function BridgeForm({
  options,
  featuredChips,
  from,
  onFrom,
  to,
  onTo,
  onSwap,
  amount,
  onAmount,
  destination,
  onDestination,
  destinationWallet,
  sourceWallet,
  quote,
  minAmount,
  estimateLoading,
  estimateError,
  feeBps,
  feePercent,
  creating,
  paying,
  onSubmit,
  onConnectSource,
}: Props) {
  const gross = parseFloat(amount) || 0
  const { fee: feeAmt, net: bridgeAmt } = splitFee(gross, feeBps)
  const receive = quote?.receive ?? null
  const belowMin = minAmount != null && bridgeAmt > 0 && bridgeAmt < minAmount
  const sourceUnit = from?.ticker.toUpperCase() || ''
  const busy = creating || paying

  const sourceFamily = walletFamilyFor(from?.network)
  const walletCanPay = Boolean(sourceFamily && sourceWallet)
  const xamanFallback = isXrpSource(from)

  const canSubmit =
    Boolean(from) &&
    Boolean(to) &&
    !busy &&
    !belowMin &&
    gross > 0 &&
    destination.trim().length > 0

  return (
    <div className="glass-card p-6 sm:p-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bridge</h1>
          <p className="mt-1 text-sm text-riddle-muted">
            {options.length.toLocaleString()}+ assets · WalletConnect
          </p>
        </div>
        <span className="chip text-violet-300">Cut {feePercent}%</span>
      </div>

      <div className="space-y-4">
        <CurrencySelect
          label="You send"
          value={from}
          options={options}
          onChange={onFrom}
          chips={featuredChips}
          totalCount={options.length}
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSwap}
            className="btn-ghost !px-2.5 !py-2"
            aria-label="Swap send and receive assets"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <CurrencySelect
          label="You receive"
          value={to}
          options={options}
          onChange={onTo}
          chips={featuredChips}
          totalCount={options.length}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
            Amount {sourceUnit && `(${sourceUnit})`}
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
            <span className="text-sm font-medium text-zinc-400">{sourceUnit}</span>
          </div>
          {minAmount != null && (
            <p className={`mt-1.5 text-[11px] ${belowMin ? 'text-rose-400' : 'text-riddle-muted'}`}>
              Min deposit after cut: {formatAmount(minAmount)} {sourceUnit}
              {belowMin ? ' — increase amount' : ''}
            </p>
          )}
        </div>

        {from && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-riddle-border bg-black/30 px-4 py-3 text-[11px]">
            <span className="text-riddle-muted">
              Paying from {networkLabel(from.network)}
            </span>
            {walletCanPay ? (
              <span className="font-mono text-emerald-400">{shortAddr(sourceWallet, 8, 6)}</span>
            ) : sourceFamily ? (
              <button type="button" className="btn-ghost !px-2.5 !py-1" onClick={onConnectSource}>
                <Wallet className="h-3.5 w-3.5" />
                <span className="text-[11px]">Connect to pay</span>
              </button>
            ) : (
              <span className="text-amber-300/90">Manual send</span>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-riddle-muted">
              Destination (
              {to ? `${to.ticker.toUpperCase()} · ${networkLabel(to.network)}` : 'receive network'})
            </label>
            {destinationWallet && destinationWallet !== destination && (
              <button
                type="button"
                className="text-[11px] text-violet-300 hover:text-violet-200"
                onClick={() => onDestination(destinationWallet)}
              >
                Use connected wallet
              </button>
            )}
          </div>
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
            <span>
              {formatAmount(gross)} {sourceUnit}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Platform cut ({feePercent}%)</span>
            <span className="text-amber-300">
              {formatAmount(feeAmt)} {sourceUnit}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-riddle-muted">Deposit amount (bridged)</span>
            <span className="font-medium text-violet-200">
              {formatAmount(bridgeAmt)} {sourceUnit}
            </span>
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
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {paying ? 'Confirm in wallet…' : 'Creating order…'}
            </>
          ) : (
            `Bridge ${sourceUnit || '…'} → ${to?.ticker.toUpperCase() || '…'}`
          )}
        </button>

        <p className="text-center text-[11px] text-riddle-muted">
          {walletCanPay
            ? 'Your wallet signs the deposit after the order is created'
            : xamanFallback
              ? 'Xaman opens to pay the XRP deposit'
              : 'Deposit address is shown after the order is created'}
        </p>
      </div>
    </div>
  )
}
