import type { ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { formatAmount, shortAddr, statusTone } from '../lib/format'
import type { BridgeStatus } from '../types'

interface Props {
  status: BridgeStatus | null
  polling: boolean
  bridgeId: string | null
}

const toneClass = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-rose-400',
  info: 'text-violet-300',
} as const

export default function StatusPanel({ status, polling, bridgeId }: Props) {
  if (!bridgeId) return null

  const tone = statusTone(status?.status || 'waiting')

  return (
    <div className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Bridge status</h3>
        {polling && (
          <span className="chip text-violet-300">
            <Loader2 className="h-3 w-3 animate-spin" /> Live
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Order ID" value={<span className="font-mono text-xs">{bridgeId}</span>} />
        <Row
          label="Status"
          value={
            <span className={`font-medium capitalize ${toneClass[tone]}`}>
              {status?.status || 'waiting'}
            </span>
          }
        />
        {status?.expectedAmountFrom != null && (
          <Row
            label="Expected deposit"
            value={`${formatAmount(status.expectedAmountFrom)} ${(status.fromCurrency || '').toUpperCase()}`}
          />
        )}
        {status?.expectedAmountTo != null && (
          <Row
            label="Expected receive"
            value={`${formatAmount(status.expectedAmountTo)} ${(status.toCurrency || '').toUpperCase()}`}
          />
        )}
        {status?.amountFrom != null && (
          <Row label="Received" value={formatAmount(status.amountFrom)} />
        )}
        {status?.amountTo != null && (
          <Row label="Sent out" value={formatAmount(status.amountTo)} />
        )}
        {status?.payinHash && (
          <Row
            label="Deposit tx"
            value={
              <a
                className="text-cyan-400 underline"
                href={`https://xrpscan.com/tx/${status.payinHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(status.payinHash, 10, 8)}
              </a>
            }
          />
        )}
        {status?.payoutHash && (
          <Row label="Payout tx" value={<span className="font-mono text-xs">{shortAddr(status.payoutHash, 10, 8)}</span>} />
        )}
      </div>

      {polling && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-riddle-muted">
          <RefreshCw className="h-3 w-3 animate-spin" /> Polling every few seconds until complete
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="text-riddle-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
