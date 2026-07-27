/**
 * Joey Wallet deep links for an XRPL WalletConnect pairing URI.
 *
 * The wallet's scheme is looked up from the WalletConnect explorer so a
 * hardcoded value cannot go stale. Note the registry stores Joey's mobile entry
 * as `joey://settings` — a scheme *plus a path*. Only the scheme is usable, so
 * it is extracted rather than concatenated, otherwise the result is the
 * nonsense `joey://settings//wc?uri=…` and the wallet opens on the wrong screen.
 */
import { projectId } from './appkit'

const EXPLORER = 'https://explorer-api.walletconnect.com/v3/wallets'

export interface WalletLinks {
  /** URI scheme without the colon, e.g. `joey` */
  scheme: string | null
  universal: string | null
}

let cached: Promise<WalletLinks> | null = null

interface ExplorerListing {
  name?: string
  mobile?: { native?: string | null; universal?: string | null }
}

/** `joey://settings` → `joey`; `joey:` → `joey`; anything odd → null. */
export function schemeOf(native?: string | null): string | null {
  if (!native) return null
  const m = native.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  return m ? m[1] : null
}

/** Cached lookup of Joey Wallet's registered deep-link scheme. */
export function joeyLinks(): Promise<WalletLinks> {
  if (!cached) {
    cached = (async (): Promise<WalletLinks> => {
      const qs = new URLSearchParams({
        projectId,
        search: 'joey',
        entries: '5',
        page: '1',
      })
      const res = await fetch(`${EXPLORER}?${qs}`)
      if (!res.ok) throw new Error(`explorer ${res.status}`)
      const data = (await res.json()) as { listings?: Record<string, ExplorerListing> }
      const listings = Object.values(data.listings || {})
      const joey =
        listings.find((l) => (l.name || '').toLowerCase().includes('joey')) || listings[0]
      return {
        scheme: schemeOf(joey?.mobile?.native) ?? 'joey',
        universal: joey?.mobile?.universal || null,
      }
    })().catch(() => ({ scheme: 'joey', universal: null }))
  }
  return cached
}

/**
 * Href that hands a pairing URI straight to Joey.
 * Falls back to the raw `wc:` URI, which the OS offers to any WC wallet.
 */
export async function joeyDeepLink(wcUri: string): Promise<string> {
  const enc = encodeURIComponent(wcUri)
  try {
    const { scheme, universal } = await joeyLinks()
    if (universal) return `${universal.replace(/\/$/, '')}/wc?uri=${enc}`
    if (scheme) return `${scheme}://wc?uri=${enc}`
  } catch {
    /* fall through to the raw URI */
  }
  return wcUri
}
