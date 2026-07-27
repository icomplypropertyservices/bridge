/**
 * Joey Wallet deep links for an XRPL WalletConnect pairing URI.
 *
 * The wallet's native scheme is looked up from the WalletConnect explorer so a
 * hardcoded scheme cannot go stale; if that lookup fails we fall back to the
 * raw `wc:` URI, which the OS routes to any installed WalletConnect wallet.
 */
import { wcProjectId } from './appkit'

const EXPLORER = 'https://explorer-api.walletconnect.com/v3/wallets'

export interface WalletLinks {
  native: string | null
  universal: string | null
}

let cached: Promise<WalletLinks> | null = null

interface ExplorerListing {
  name?: string
  mobile?: { native?: string | null; universal?: string | null }
  desktop?: { native?: string | null; universal?: string | null }
}

/** Cached lookup of Joey Wallet's registered deep-link schemes. */
export function joeyLinks(): Promise<WalletLinks> {
  if (!cached) {
    cached = (async (): Promise<WalletLinks> => {
      const qs = new URLSearchParams({
        projectId: wcProjectId,
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
        native: joey?.mobile?.native || null,
        universal: joey?.mobile?.universal || null,
      }
    })().catch(() => ({ native: null, universal: null }))
  }
  return cached
}

/**
 * Build the href that opens Joey with a pairing URI.
 * Returns the raw `wc:` URI when no wallet-specific scheme is known.
 */
export async function joeyDeepLink(wcUri: string): Promise<string> {
  const enc = encodeURIComponent(wcUri)
  try {
    const links = await joeyLinks()
    if (links.universal) return `${trimSlash(links.universal)}/wc?uri=${enc}`
    if (links.native) return `${links.native.replace(/\/$/, '')}//wc?uri=${enc}`
  } catch {
    /* fall through to the raw URI */
  }
  return wcUri
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, '')
}
