import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { formatAmount, networkLabel, shortAddr } from '../lib/format'
import { qrDataUrl } from '../lib/qr'
import { txExplorerUrl } from '../lib/explorer'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import { depositAmount, depositTag, isXrpSource } from '../domain/bridge'
import { walletFamilyFor } from '../lib/wallet/networks'
import { feeTargetFor, type FeeAddressMap } from '../lib/wallet/feeWallet'
import type { StepState } from '../hooks/useBridgeFlow'
import type { BridgeCreateResult, BridgeCurrency } from '../types'

interface Props {
  order: BridgeCreateResult
  from: BridgeCurrency | null
  sourceWallet: string
  paying: boolean
  feeStep: StepState
  depositStep: StepState
  feeAmount: number
  feeAddresses: FeeAddressMap | undefined
  feeTxId: string | null
  depositTxId: string | null
  onPay: () => void
}

export default function DepositPanel({
  order,
  from,
  sourceWallet,
  paying,
  feeStep,
  depositStep,
  feeAmount,
  feeAddresses,
  feeTxId,
  depositTxId,
  onPay,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [qr, setQr] = useState('')

  const isXrp = isXrpSource(from) || order.fromNetwork === 'xrp'
  const amount = depositAmount(order)
  const tag = depositTag(order)
  const unit = order.fromCurrency.toUpperCase()
  const network = order.fromNetwork || from?.network

  const xamanLink = useMemo(() => (isXrp ? buildDepositDeepLink(order) : null), [isXrp, order])
  const canWalletPay = Boolean(walletFamilyFor(from?.network) && sourceWallet)

  // No fee wallet for this chain → the cut stays a deduction, so there is no step 1.
  const sourceFamily = walletFamilyFor(from?.network)
  const feeTarget = feeTargetFor(sourceFamily, feeAddresses)
  const hasFeeStep = Boolean(feeTarget && feeAmount > 0)
  // Skipping step 1 silently reads like a bug; name the reason.
  const feeStepSkipped = Boolean(sourceFamily && !feeTarget && feeAmount > 0)

  useEffect(() => {
    const href = xamanLink?.href
    if (!href) {
      setQr('')
      return
    }
    let cancelled = false
    void qrDataUrl(href, 220)
      .then((data) => {
        if (!cancelled) setQr(data)
      })
      .catch(() => {
        if (!cancelled) setQr('')
      })
    return () => {
      cancelled = true
    }
  }, [xamanLink?.href])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Copied')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  const allDone = depositStep === 'done' && (!hasFeeStep || feeStep === 'done')

  return (
    <div className="glass-card p-5">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-300">
        {allDone ? 'Bridge funded' : 'Pay to complete'}
      </div>
      <h3 className="text-lg font-semibold">
        {allDone ? 'Payments sent' : `Send ${formatAmount(amount)} ${unit}`}
      </h3>
      <p className="mt-1 text-sm text-riddle-muted">
        Order <span className="font-mono text-zinc-400">{order.id}</span>
      </p>

      {!allDone && (
        <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="text-sm font-semibold text-amber-200">
            Not sent yet — the bridge is waiting for your {unit}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-200/80">
            The order is reserved but nothing has moved.
            {hasFeeStep
              ? ` Two payments are needed: the ${formatAmount(feeAmount)} ${unit} platform fee, then the ${formatAmount(amount)} ${unit} deposit.`
              : ` Send exactly ${formatAmount(amount)} ${unit}${tag ? ' with the tag below' : ''} to finish. The platform cut was already taken off this amount — there is no separate fee payment.`}
          </p>
        </div>
      )}

      {feeStepSkipped && (
        <div className="mt-3 rounded-2xl border border-riddle-border bg-black/30 p-3">
          <div className="text-[12px] font-medium text-zinc-300">
            One transaction only on {networkLabel(from?.network || '')}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-riddle-muted">
            No fee wallet is configured for this chain, so the {formatAmount(feeAmount)} {unit} cut
            was deducted from the deposit instead of being sent separately. Set{' '}
            <code className="text-zinc-400">
              PLATFORM_FEE_ADDRESS_{sourceFamily === 'solana' ? 'SOL' : 'EVM'}
            </code>{' '}
            to collect it as its own transaction.
          </p>
        </div>
      )}

      {/* Both legs, so it is obvious which one is outstanding */}
      <div className="mt-4 space-y-2">
        {hasFeeStep && (
          <StepRow
            index={1}
            label={`Platform fee → ${shortAddr(feeTarget!.address, 8, 6)}`}
            amount={`${formatAmount(feeAmount)} ${unit}`}
            state={feeStep}
            txId={feeTxId}
            network={network}
          />
        )}
        <StepRow
          index={hasFeeStep ? 2 : 1}
          label="Bridge deposit"
          amount={`${formatAmount(amount)} ${unit}`}
          state={depositStep}
          txId={depositTxId}
          network={network}
        />
      </div>

      <div className="mt-4 space-y-3">
        {canWalletPay && !allDone && (
          <button type="button" className="btn-primary w-full" disabled={paying} onClick={onPay}>
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Confirm in wallet…
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                {feeStep === 'done' && depositStep !== 'done'
                  ? `Pay ${formatAmount(amount)} ${unit} deposit`
                  : hasFeeStep
                    ? `Pay fee + deposit from ${shortAddr(sourceWallet)}`
                    : `Pay ${formatAmount(amount)} ${unit} from ${shortAddr(sourceWallet)}`}
              </>
            )}
          </button>
        )}

        {xamanLink && !allDone && (
          <button
            type="button"
            className={canWalletPay ? 'btn-ghost w-full' : 'btn-primary w-full'}
            onClick={() => openXamanDeepLink(xamanLink)}
          >
            <ExternalLink className="h-4 w-4" />
            Pay {formatAmount(amount)} {unit} in Xaman
          </button>
        )}

        {qr && !allDone && (
          <>
            <div className="mx-auto w-fit rounded-2xl border border-riddle-border bg-white p-2.5">
              <img src={qr} alt="Scan to open Xaman payment" className="h-[200px] w-[200px]" />
            </div>
            <p className="text-center text-[11px] text-riddle-muted">
              Deep link / QR · amount &amp; destination tag included
            </p>
          </>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <CopyField
          label="Deposit address"
          value={order.payinAddress}
          copied={copied === 'addr'}
          onCopy={() => copy(order.payinAddress, 'addr')}
        />
        {tag && (
          <CopyField
            label={order.payinExtraIdName || 'Memo / Destination tag'}
            value={tag}
            copied={copied === 'tag'}
            onCopy={() => copy(tag, 'tag')}
            warn
          />
        )}
        <div className="rounded-2xl border border-riddle-border bg-black/30 p-3 text-sm">
          <div className="flex justify-between gap-2 py-1">
            <span className="text-riddle-muted">You receive (est.)</span>
            <span className="font-medium">
              {formatAmount(order.toAmount)} {order.toCurrency.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between gap-2 py-1">
            <span className="text-riddle-muted">Payout to</span>
            <span className="font-mono text-xs">{shortAddr(order.payoutAddress, 8, 6)}</span>
          </div>
          {order.fromNetwork && order.toNetwork && (
            <div className="flex justify-between gap-2 py-1">
              <span className="text-riddle-muted">Route</span>
              <span className="text-xs">
                {networkLabel(order.fromNetwork)} → {networkLabel(order.toNetwork)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepRow({
  index,
  label,
  amount,
  state,
  txId,
  network,
}: {
  index: number
  label: string
  amount: string
  state: StepState
  txId: string | null
  network?: string
  }) {
  const url = txId ? txExplorerUrl(network, txId) : null
  const tone =
    state === 'done'
      ? 'border-emerald-500/40 bg-emerald-500/10'
      : state === 'failed'
        ? 'border-rose-500/40 bg-rose-500/10'
        : state === 'running'
          ? 'border-violet-500/40 bg-violet-500/10'
          : 'border-riddle-border bg-black/30'

  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px]">
          {state === 'done' ? <Check className="h-3 w-3 text-emerald-400" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{label}</div>
          <div className="text-[11px] text-riddle-muted">{amount}</div>
        </div>
        <span className="shrink-0 text-[11px]">
          {state === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />}
          {state === 'done' && <span className="text-emerald-400">Sent</span>}
          {state === 'failed' && <span className="text-rose-400">Failed</span>}
          {state === 'idle' && <span className="text-riddle-muted">Pending</span>}
        </span>
      </div>
      {txId && (
        <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-400">
            {txId}
          </code>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] text-violet-300 hover:text-violet-200"
            >
              View ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function CopyField({
  label,
  value,
  onCopy,
  copied,
  warn,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        warn ? 'border-amber-500/40 bg-amber-500/5' : 'border-riddle-border bg-black/30'
      }`}
    >
      <div className="mb-1 text-[11px] uppercase tracking-wide text-riddle-muted">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-sm">{value}</code>
        <button type="button" onClick={onCopy} className="btn-ghost !px-2.5 !py-2 shrink-0">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
