import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { networkLabel } from '../lib/format'
import { sortSearchResults } from '../lib/tokens'
import type { BridgeCurrency } from '../types'
import { currencyKey } from '../types'
import TokenLogo from './TokenLogo'

interface Props {
  label: string
  value: BridgeCurrency | null
  options: BridgeCurrency[]
  onChange: (c: BridgeCurrency) => void
  disabled?: boolean
}

export default function CurrencySelect({ label, value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  /** Full collector: already sorted in useCurrencies; search re-sorts results. */
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) {
      // Show full sorted list (no hard 200 cap — virtual-ish via max-height scroll)
      return options
    }
    const hits = options.filter((c) => {
      const hay = `${c.ticker} ${c.name} ${c.network} ${c.legacyTicker || ''}`.toLowerCase()
      return hay.includes(query)
    })
    return sortSearchResults(hits)
  }, [options, q])

  return (
    <div className="relative" ref={rootRef}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-riddle-muted">{label}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="field flex items-center gap-3 text-left"
      >
        <TokenLogo ticker={value?.ticker} image={value?.image} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{value ? value.ticker.toUpperCase() : 'Select'}</div>
          <div className="truncate text-[11px] text-riddle-muted">
            {value ? `${value.name} · ${networkLabel(value.network)}` : 'Choose asset & network'}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-hidden rounded-2xl border border-riddle-border bg-[#0d0d14] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-riddle-border px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticker, name, network…"
              className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">No matches</div>
            )}
            {filtered.map((c) => {
              const key = currencyKey(c)
              const active = value && currencyKey(value) === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                    setQ('')
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5 ${
                    active ? 'bg-violet-500/15' : ''
                  }`}
                >
                  <TokenLogo ticker={c.ticker} image={c.image} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.ticker.toUpperCase()}</span>
                      {c.featured && (
                        <span className="chip !py-0.5 text-[10px] text-violet-300">Featured</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-riddle-muted">
                      {c.name} · {networkLabel(c.network)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
