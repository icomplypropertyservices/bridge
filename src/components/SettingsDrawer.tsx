import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  feePercent: string
}

export default function SettingsDrawer({ open, onClose, feePercent }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md border-l border-riddle-border bg-[#0b0b12] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">About</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 text-sm">
          <div className="rounded-2xl border border-riddle-border bg-black/30 p-4">
            <div className="text-xs uppercase tracking-wider text-riddle-muted">Platform cut</div>
            <div className="mt-1 text-2xl font-semibold text-violet-300">{feePercent}%</div>
            <p className="mt-1 text-[11px] text-riddle-muted">
              Reduces deposit size (net amount bridged). Not a separate fee-wallet payment.
            </p>
          </div>

          <div className="rounded-2xl border border-riddle-border bg-black/30 p-4 text-[11px] text-riddle-muted leading-relaxed space-y-2">
            <p className="font-medium text-zinc-300">Connect Wallet</p>
            <p>
              WalletConnect via Reown AppKit for Ethereum/EVM and Solana. XRPL connects over
              WalletConnect v2 (<code className="text-zinc-400">xrpl:0</code>) — Joey Wallet and any
              other XRPL wallet that supports it.
            </p>
            <p className="font-medium text-zinc-300 pt-1">Deposits</p>
            <p>
              A connected wallet signs the deposit directly. XRP additionally supports{' '}
              <code className="text-zinc-400">xaman.app/detect/request:…</code> deep links with
              amount &amp; tag — no connection required.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
