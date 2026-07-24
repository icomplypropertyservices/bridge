/**
 * Xaman = Payment Request deep links only.
 * QR is just that deep link as an image — not a second system.
 * @see https://docs.xaman.dev/simple-link-qr/payment-request-link
 */
import QRCode from 'qrcode'
import type { BridgeCreateResult } from '../types'

export interface PaymentRequestParams {
  address: string
  amount: number | string
  destinationTag?: string | number | null
  network?: 'XRPL' | 'XAHAU'
}

export interface DepositDeepLink {
  /** https://xaman.app/detect/request:… — primary deep link */
  href: string
  /** xumm://… — native app scheme */
  nativeHref: string
  amount: number | string
  address: string
  destinationTag?: string | null
}

export function buildDepositDeepLink(order: BridgeCreateResult): DepositDeepLink {
  const address = order.payinAddress.trim()
  const amount = order.directedAmount ?? order.fromAmount
  const tag =
    order.payinExtraId != null && String(order.payinExtraId).trim() !== ''
      ? String(order.payinExtraId).trim()
      : null

  const qs = new URLSearchParams()
  if (amount != null && Number(amount) > 0) qs.set('amount', String(amount))
  qs.set('network', 'XRPL')
  if (tag) qs.set('dt', tag)

  const href = `https://xaman.app/detect/request:${address}?${qs.toString()}`
  const nativeHref = href.replace('https://xaman.app/', 'xumm://xumm.app/')

  return { href, nativeHref, amount, address, destinationTag: tag }
}

export function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** Fire the deep link (native scheme on mobile, web deep link otherwise). */
export function openXamanDeepLink(link: DepositDeepLink): void {
  try {
    if (isMobileUa()) {
      window.location.href = link.nativeHref
      // Fallback if app not installed / scheme ignored
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.location.href = link.href
        }
      }, 700)
    } else {
      // Desktop: open Xaman web/detect flow (user-invoked preferred)
      window.open(link.href, '_blank', 'noopener,noreferrer')
    }
  } catch {
    window.open(link.href, '_blank', 'noopener,noreferrer')
  }
}

export async function qrDataUrl(href: string, size = 240): Promise<string> {
  return QRCode.toDataURL(href, {
    width: size,
    margin: 2,
    color: { dark: '#0b0b12', light: '#ffffff' },
  })
}
