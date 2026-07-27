import { useState } from 'react'
import { ChevronDown, History, Trash2 } from 'lucide-react'
import { formatAmount, networkLabel, shortAddr, statusTone } from '../lib/format'
import { txExplorerUrl } from '../lib/explorer'
import type { BridgeRecord } from '../lib/history'

interface Props {
  records: BridgeRecord[]
  activeId: string | null
  onSelect: (record: BridgeRecord) => void
  onRemove: (id: string) => void
  onClear: () => void
}

const TONE_CLASS: Record<string, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-300',
  bad: 'text-rose-400',
  info: 'text-zinc-400',
}

export default function HistoryPanel({ records, activeId, onSelect, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(false)

  if (records.length === 0) return null

  const shown = open ? records : records.slice(0, 3)

  return (
    <div className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-violet-300" />
          <span className="text-sm font-semibold">Previous bridges</span>
          <span className="chip !py-0.5 text-[10px] text-riddle-muted">{records.length}</span>
        </div>
        <button
          type="button"
          className="text-[11px] text-riddle-muted hover:text-rose-300"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <div className="space-y-2">
        {shown.map((r) => {
          const tone = TONE_CLASS[statusTone(r.status || 'new')] || 'text-zinc-400'
          const feeUrl = r.feeTxId ? txExplorerUrl(r.fromNetwork, r.feeTxId) : null
          const depUrl = r.depositTxId ? txExplorerUrl(r.fromNetwork, r.depositTxId) : null
          const isActive = r.id === activeId

          return (
            <div
              key={r.id}
              className={`rounded-2xl border p-3 transition ${
                isActive
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-riddle-border bg-black/30 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(r)}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>
                      {formatAmount(r.amount)} {r.fromCurrency.toUpperCase()}
                    </span>
                    <span className="text-riddle-muted">→</span>
                    <span>
                      {formatAmount(r.toAmount)} {r.toCurrency.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-riddle-muted">
                    {networkLabel(r.fromNetwork)} → {networkLabel(r.toNetwork)} ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className={tone}>{(r.status || 'new').toUpperCase()}</span>
                    <span className="font-mono text-zinc-600">{shortAddr(r.id, 8, 4)}</span>
                    {r.feeTxId &&
                      (feeUrl ? (
                        <a
                          href={feeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-300 hover:text-violet-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          fee ↗
                        </a>
                      ) : (
                        <span className="text-zinc-500">fee sent</span>
                      ))}
                    {r.depositTxId &&
                      (depUrl ? (
                        <a
                          href={depUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-300 hover:text-violet-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          deposit ↗
                        </a>
                      ) : (
                        <span className="text-zinc-500">deposit sent</span>
                      ))}
                  </div>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-rose-300"
                  title="Remove from history"
                  onClick={() => onRemove(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {records.length > 3 && (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] text-riddle-muted hover:text-zinc-300"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
          {open ? 'Show less' : `Show all ${records.length}`}
        </button>
      )}
    </div>
  )
}
