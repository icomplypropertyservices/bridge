/**
 * Platform fee wallets, one per chain family.
 *
 * A fee address is chain-specific. The XRPL r-address cannot receive ETH or
 * SOL, so every address is shape-checked against the family it will be used
 * for and a mismatch is refused outright — sending a fee to an address the
 * chain cannot own would burn the user's funds.
 */
import { PublicKey } from '@solana/web3.js'
import type { WalletFamily } from './networks'

export interface FeeAddressMap {
  xrpl?: string
  eip155?: string
  solana?: string
}

/**
 * Shape checks strong enough to catch a cross-chain mix-up.
 *
 * Solana is decoded rather than regex-matched: an XRPL r-address is also
 * base58 and 34 chars, so it satisfies a naive `{32,44}` pattern and would be
 * accepted as a Solana fee wallet — sending SOL to an address nobody controls.
 * `PublicKey` enforces the 32-byte length that actually distinguishes them.
 */
export function looksLikeAddress(family: WalletFamily, address: string): boolean {
  const a = (address || '').trim()
  if (!a) return false
  if (family === 'eip155') return /^0x[0-9a-fA-F]{40}$/.test(a)
  if (family === 'solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false
    try {
      return new PublicKey(a).toBytes().length === 32
    } catch {
      return false
    }
  }
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)
}

export interface FeeTarget {
  family: WalletFamily
  address: string
}

/**
 * Fee wallet for a family, or null when none is usable.
 * Returning null means "no fee step" — the caller falls back to the deduction
 * model rather than guessing an address.
 */
export function feeTargetFor(
  family: WalletFamily | null,
  map: FeeAddressMap | undefined,
): FeeTarget | null {
  if (!family || !map) return null
  const address = (map[family] || '').trim()
  if (!address) return null
  if (!looksLikeAddress(family, address)) return null
  return { family, address }
}

/** Why a fee step is unavailable, for surfacing in the UI. */
export function feeConfigProblem(
  family: WalletFamily | null,
  map: FeeAddressMap | undefined,
): string | null {
  if (!family) return null
  const address = (map?.[family] || '').trim()
  if (!address) return null
  if (!looksLikeAddress(family, address)) {
    return `The configured ${family} fee wallet is not a valid address for that chain`
  }
  return null
}
