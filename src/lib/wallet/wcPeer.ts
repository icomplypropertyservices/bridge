/**
 * Hand focus back to the wallet app after issuing a WalletConnect request.
 *
 * On mobile the request travels over the relay while the user is still looking
 * at the browser, so nothing appears to happen — the prompt is sitting in a
 * wallet app that was never brought to the foreground. WalletConnect sessions
 * advertise the peer's deep link in `peer.metadata.redirect` exactly for this;
 * AppKit does it for its own sessions, so the custom-namespace clients here
 * have to do it themselves.
 *
 * Desktop is left alone: the wallet is a browser extension or a scanned mobile
 * session, and navigating away would abandon the pending request.
 */
import type { SessionTypes } from '@walletconnect/types'
import { isMobileUa } from '../ua'

interface PeerRedirect {
  native?: string
  universal?: string
}

export function peerRedirect(session?: SessionTypes.Struct | null): PeerRedirect | null {
  const redirect = session?.peer?.metadata?.redirect as PeerRedirect | undefined
  if (!redirect) return null
  if (!redirect.native && !redirect.universal) return null
  return redirect
}

/**
 * Open the connected wallet so the pending prompt is visible.
 * No-op on desktop, and silent when the peer advertises no redirect.
 */
export function focusPeerWallet(session?: SessionTypes.Struct | null): void {
  if (!isMobileUa()) return
  const redirect = peerRedirect(session)
  if (!redirect) return

  const href = redirect.native || redirect.universal
  if (!href) return

  try {
    // An anchor keeps this tab (and the pending request) alive where
    // location.href would tear the page down on some mobile browsers.
    const a = document.createElement('a')
    a.href = href
    a.style.display = 'none'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    try {
      window.location.href = href
    } catch {
      /* nothing more we can do — the prompt is still in the wallet */
    }
  }
}
