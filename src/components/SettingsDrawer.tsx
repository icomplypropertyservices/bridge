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
            <div className="text-xs uppercase tracking-wider text-riddle-muted">Platform fee</div>
            <div className="mt-1 text-2xl font-semibold text-violet-300">{feePercent}%</div>
            <p className="mt-1 text-[11px] text-riddle-muted">
              Applied on every bridge. Shown before you confirm.
            </p>
          </div>

          <div className="rounded-2xl border border-riddle-border bg-black/30 p-4 text-[11px] text-riddle-muted leading-relaxed space-y-2">
            <p className="font-medium text-zinc-300">Connect Wallet</p>
            <p>
              Xaman Sign-In: QR on desktop, deep link opens the app on mobile. We poll until you
              approve — no paste address.
            </p>
            <p className="font-medium text-zinc-300 pt-1">Deposits</p>
            <p>
              XRPL deposits use{' '}
              <code className="text-zinc-400">xaman.app/detect/request:…</code> deep links with
              amount & tag.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
