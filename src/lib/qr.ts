import QRCode from 'qrcode'

/** PNG data URL for any URI — Xaman deep links and WalletConnect pairings alike. */
export async function qrDataUrl(href: string, size = 240): Promise<string> {
  return QRCode.toDataURL(href, {
    width: size,
    margin: 2,
    color: { dark: '#0b0b12', light: '#ffffff' },
  })
}
