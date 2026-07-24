import { ExternalLink, Loader2, X } from 'lucide-react'
import type { ConnectStatus, XummPayloadResponse } from '../types'

interface Props {
  open: boolean
  payload: XummPayloadResponse | null
  status: ConnectStatus
  onClose: () => void
  onOpenDeepLink: () => void
}

export default function ConnectModal({ open, payload, status, onClose, onOpenDeepLink }: Props) {
  if (!open || !payload) return null

  const web = payload.next?.always || `https://xumm.app/sign/${payload.uuid}`

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="glass-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Connect Wallet</h3>
            <p className="mt-1 text-sm text-riddle-muted">
              Scan the QR on web, or open Xaman on mobile — waiting for approval
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {payload.refs?.qr_png && (
          <div className="mx-auto mt-6 w-fit rounded-2xl border border-riddle-border bg-white p-3">
            <img src={payload.refs.qr_png} alt="Scan with Xaman" className="h-[240px] w-[240px]" />
          </div>
        )}

        <div className="mt-4 grid gap-2">
          <button type="button" className="btn-primary w-full" onClick={onOpenDeepLink}>
            <ExternalLink className="h-4 w-4" />
            Open in Xaman app
          </button>
          <a href={web} target="_blank" rel="noreferrer" className="btn-ghost w-full text-center">
            Open sign link
          </a>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-300">
          {status === 'pending' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              Waiting for Xaman…
            </>
          )}
          {status === 'signed' && <span className="text-emerald-400">Connected</span>}
          {status === 'rejected' && <span className="text-rose-400">Cancelled</span>}
          {status === 'expired' && <span className="text-amber-400">Expired</span>}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">Sign-In · {payload.uuid}</p>
      </div>
    </div>
  )
}
