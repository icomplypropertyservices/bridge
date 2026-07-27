import QRCode from 'qrcode'

/**
 * PNG data URL for a URI — WalletConnect pairings and Xaman deep links alike.
 *
 * Error correction is deliberately 'L'. A `wc:` pairing URI runs ~190 chars,
 * which at the library default ('M') needs a version-10 symbol of 57 modules;
 * at 'L' the same payload fits version 8 / 49 modules, so each module is
 * ~35% larger on screen and scans far more reliably. WalletConnect's own QR
 * uses low correction for the same reason.
 */
export async function qrDataUrl(href: string, size = 280): Promise<string> {
  return QRCode.toDataURL(href, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'L',
    color: { dark: '#0b0b12', light: '#ffffff' },
  })
}
