/**
 * Xaman helpers:
 * - Connect: Platform Sign-In (server proxy) — see useWalletConnect
 * - Deposit execute: payment-request deep link (no Platform payload)
 */
import QRCode from 'qrcode'
import type { BridgeCreateResult } from '../types'
import { depositAmount } from '../domain/xrpOut'

export interface XamanOpenUrls {
  web: string
  native: string
}

export interface DepositDeepLink extends XamanOpenUrls {
  href: string
  nativeHref: string
  amount: number | string
  address: string
  destinationTag?: string | null
}

export function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/**
 * Open Xaman without always unloading the SPA.
 * Mobile: try custom-scheme via hidden anchor (keeps tab + poll alive).
 * Fallback to web universal link only if the page is still foreground after a beat.
 * Desktop: open universal link in a new tab (QR still shown in-app).
 */
export function openXamanUrls(urls: XamanOpenUrls): void {
  try {
    if (isMobileUa()) {
      // Prefer not using location.href — that kills React state + poll on many browsers.
      const a = document.createElement('a')
      a.href = urls.native
      a.style.display = 'none'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      // If the app did not take over, fall back to universal link (may leave page).
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.location.href = urls.web
        }
      }, 900)
    } else {
      window.open(urls.web, '_blank', 'noopener,noreferrer')
    }
  } catch {
    window.open(urls.web, '_blank', 'noopener,noreferrer')
  }
}

export function buildDepositDeepLink(order: BridgeCreateResult): DepositDeepLink {
  const address = order.payinAddress.trim()
  const amount = depositAmount(order)
  const tag =
    order.payinExtraId != null && String(order.payinExtraId).trim() !== ''
      ? String(order.payinExtraId).trim()
      : null

  const qs = new URLSearchParams()
  if (amount > 0) qs.set('amount', String(amount))
  qs.set('network', 'XRPL')
  if (tag) qs.set('dt', tag)

  const href = `https://xaman.app/detect/request:${address}?${qs.toString()}`
  const nativeHref = href.replace('https://xaman.app/', 'xumm://xumm.app/')
  return {
    href,
    nativeHref,
    web: href,
    native: nativeHref,
    amount,
    address,
    destinationTag: tag,
  }
}

export function openXamanDeepLink(link: DepositDeepLink): void {
  openXamanUrls({ web: link.web, native: link.native })
}

export function signInUrls(uuid: string, nextAlways?: string): XamanOpenUrls {
  const web = nextAlways || `https://xumm.app/sign/${uuid}`
  const native = `xumm://xumm.app/sign/${uuid}`
  return { web, native }
}

export async function qrDataUrl(href: string, size = 240): Promise<string> {
  return QRCode.toDataURL(href, {
    width: size,
    margin: 2,
    color: { dark: '#0b0b12', light: '#ffffff' },
  })
}
