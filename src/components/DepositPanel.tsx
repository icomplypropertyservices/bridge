import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { formatAmount, networkLabel, shortAddr } from '../lib/format'
import { qrDataUrl } from '../lib/qr'
import { buildDepositDeepLink, openXamanDeepLink } from '../lib/xaman'
import { depositAmount, depositTag, isXrpSource } from '../domain/bridge'
import { walletFamilyFor } from '../lib/wallet/networks'
import type { BridgeCreateResult, BridgeCurrency } from '../types'

interface Props {
  order: BridgeCreateResult
  from: BridgeCurrency | null
  /** Connected address able to fund this deposit, if any */
  sourceWallet: string
  paying: boolean
  onPay: () => void
}

/**
 * Deposit instructions for the created order.
 * XRP keeps the Xaman payment-request deep link + QR; every network shows the
 * raw address, and a connected wallet can sign the transfer in one click.
 */
export default function DepositPanel({ order, from, sourceWallet, paying, onPay }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [qr, setQr] = useState('')

  const isXrp = isXrpSource(from) || order.fromNetwork === 'xrp'
  const amount = depositAmount(order)
  const tag = depositTag(order)
  const unit = order.fromCurrency.toUpperCase()

  const xamanLink = useMemo(() => (isXrp ? buildDepositDeepLink(order) : null), [isXrp, order])
  const canWalletPay = Boolean(walletFamilyFor(from?.network) && sourceWallet)
  const feeNote = 'platform cut'

  useEffect(() => {
    const href = xamanLink?.href
    if (!href) {
      setQr('')
      return
    }
    let cancelled = false
    void qrDataUrl(href, 220).then((data) => {
      if (!cancelled) setQr(data)
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

  return (
    <div className="glass-card p-5">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-300">
        Step 2 of 2 · Pay the deposit
      </div>
      <h3 className="text-lg font-semibold">
        Send exactly {formatAmount(amount)} {unit}
      </h3>
      <p className="mt-1 text-sm text-riddle-muted">
        Order <span className="font-mono text-zinc-400">{order.id}</span>
      </p>

      {/* The order alone moves nothing — say so, because a created order looks
          finished and users have stopped here thinking the bridge was done. */}
      <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
        <div className="text-sm font-semibold text-amber-200">
          Not sent yet — the bridge is waiting for your {unit}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-amber-200/80">
          The order is reserved but nothing has moved. Send exactly{' '}
          <strong className="text-amber-100">
            {formatAmount(amount)} {unit}
          </strong>
          {tag ? ' with the tag below' : ''} to finish. The {feeNote} was already taken off this
          amount — there is no separate fee payment.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {canWalletPay && (
          <button type="button" className="btn-primary w-full" disabled={paying} onClick={onPay}>
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Confirm in wallet…
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Pay {formatAmount(amount)} {unit} from{' '}
                {shortAddr(sourceWallet)}
              </>
            )}
          </button>
        )}

        {xamanLink && (
          <button
            type="button"
            className={canWalletPay ? 'btn-ghost w-full' : 'btn-primary w-full'}
            onClick={() => openXamanDeepLink(xamanLink)}
          >
            <ExternalLink className="h-4 w-4" />
            Pay {formatAmount(amount)} {unit} in Xaman
          </button>
        )}

        {qr && (
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

      <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">
        {canWalletPay
          ? 'Paying from the connected wallet fills the amount and tag for you.'
          : 'If you send manually, use the exact amount' + (tag ? ' and destination tag.' : '.')}
      </p>
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
