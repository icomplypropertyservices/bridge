import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react'
import { qrDataUrl } from '../lib/qr'
import { isMobileUa } from '../lib/ua'

interface Props {
  /** WalletConnect pairing URI — empty until the provider emits it */
  uri: string
  connecting: boolean
  /** Joey-specific deep link, resolved from the WalletConnect explorer */
  joeyHref: string
  onClose: () => void
}

/**
 * XRPL pairing UI. AppKit's modal only covers the namespaces its adapters
 * register, so the XRPL session gets its own QR + deep link surface.
 */
export default function JoeyConnectModal({ uri, connecting, joeyHref, onClose }: Props) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!uri) {
      setQr('')
      return
    }
    let cancelled = false
    void qrDataUrl(uri, 280).then((data) => {
      if (!cancelled) setQr(data)
    })
    return () => {
      cancelled = true
    }
  }, [uri])

  if (!connecting && !uri) return null

  const openHref = joeyHref || uri

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the QR is still usable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="glass-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Connect XRPL wallet</h3>
            <p className="mt-1 text-sm text-riddle-muted">
              Scan from <strong className="text-zinc-300">inside Joey Wallet</strong> — use its
              WalletConnect scanner, not your camera app
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {qr ? (
          <div className="mx-auto mt-6 w-fit rounded-2xl border border-riddle-border bg-white p-3">
            <img src={qr} alt="Scan with Joey Wallet" className="h-[280px] w-[280px]" />
          </div>
        ) : (
          <div className="mt-6 flex h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}

        <p className="mt-3 text-center text-[11px] text-amber-200/80">
          A phone camera will only show text — this encodes a WalletConnect
          <code className="mx-1 text-amber-100">wc:</code>
          session, which only a wallet can open.
        </p>

        {uri && (
          <div className="mt-4 grid gap-2">
            <a
              href={openHref}
              target={isMobileUa() ? undefined : '_blank'}
              rel="noreferrer"
              className="btn-primary w-full justify-center text-center"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Joey Wallet
            </a>
            <button type="button" className="btn-ghost w-full" onClick={() => void copy()}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy connection link
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          Waiting for approval…
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          WalletConnect · xrpl:0 · any XRPL wallet that supports WalletConnect v2
        </p>
      </div>
    </div>
  )
}
