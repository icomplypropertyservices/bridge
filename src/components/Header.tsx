import { Settings, Wallet } from 'lucide-react'
import { shortAddr } from '../lib/format'

interface Props {
  address: string
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  onOpenSettings: () => void
  feePercent: string
}

export default function Header({
  address,
  connecting,
  onConnect,
  onDisconnect,
  onOpenSettings,
  feePercent,
}: Props) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5">
      <div className="flex items-center gap-3">
        <img src="/logo.jpg" alt="Riddle" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10" />
        <div>
          <div className="text-lg font-bold tracking-tight">Riddle Bridge</div>
          <div className="text-[11px] text-riddle-muted">
            Cross-chain · Connect Wallet · {feePercent}% fee
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost !px-3" onClick={onOpenSettings} aria-label="Settings">
          <Settings className="h-4 w-4" />
        </button>
        {address ? (
          <button type="button" className="btn-ghost" onClick={onDisconnect}>
            <Wallet className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs">{shortAddr(address)}</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary !py-2.5"
            onClick={onConnect}
            disabled={connecting}
          >
            <Wallet className="h-4 w-4" />
            {connecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </header>
  )
}
