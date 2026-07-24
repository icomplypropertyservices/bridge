import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { formatAmount, shortAddr } from '../lib/format'
import { buildDepositDeepLink, openXamanDeepLink, qrDataUrl } from '../lib/xaman'
import type { BridgeCreateResult } from '../types'

interface Props {
  order: BridgeCreateResult
}

/** XRP-out deposit: always show Xaman payment-request deep link + QR. */
export default function DepositPanel({ order }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [qr, setQr] = useState('')

  const link = useMemo(() => buildDepositDeepLink(order), [order])
  const amount = link.amount

  useEffect(() => {
    let cancelled = false
    void qrDataUrl(link.href, 220).then((data) => {
      if (!cancelled) setQr(data)
    })
    return () => {
      cancelled = true
    }
  }, [link.href])

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
        Deposit to complete
      </div>
      <h3 className="text-lg font-semibold">
        Send exactly {formatAmount(amount)} XRP
      </h3>
      <p className="mt-1 text-sm text-riddle-muted">
        Order <span className="font-mono text-zinc-400">{order.id}</span>
      </p>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => openXamanDeepLink(link)}
        >
          <ExternalLink className="h-4 w-4" />
          Open in Xaman
        </button>

        {qr && (
          <div className="mx-auto w-fit rounded-2xl border border-riddle-border bg-white p-2.5">
            <img src={qr} alt="Scan to open Xaman payment" className="h-[200px] w-[200px]" />
          </div>
        )}
        <p className="text-center text-[11px] text-riddle-muted">
          Deep link / QR · amount & destination tag included
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <CopyField
          label="Deposit address"
          value={order.payinAddress}
          copied={copied === 'addr'}
          onCopy={() => copy(order.payinAddress, 'addr')}
        />
        {order.payinExtraId && (
          <CopyField
            label={order.payinExtraIdName || 'Memo / Destination tag'}
            value={String(order.payinExtraId)}
            copied={copied === 'tag'}
            onCopy={() => copy(String(order.payinExtraId), 'tag')}
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
              <span className="text-xs uppercase">
                {order.fromNetwork} → {order.toNetwork}
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">
        Prefer the Xaman deep link. If you send manually, use the exact amount and destination tag.
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
