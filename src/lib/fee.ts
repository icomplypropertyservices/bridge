/** Platform cut applied as reduced bridge size (not a separate fee-wallet capture). */
export const DEFAULT_FEE_BPS = 85

export type FeeSplit = {
  /** User-entered XRP amount */
  gross: number
  /** Platform cut in XRP (not collected on-chain separately) */
  fee: number
  /** Amount used for estimate + create + deposit */
  net: number
  bps: number
}

export function feeFromBps(amount: number, bps: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (!Number.isFinite(bps) || bps <= 0) return 0
  return (amount * bps) / 10_000
}

export function netAfterFee(amount: number, bps: number): number {
  return Math.max(0, amount - feeFromBps(amount, bps))
}

/** Single source of truth: gross → fee cut → net bridged. */
export function splitFee(gross: number, bps: number): FeeSplit {
  const fee = feeFromBps(gross, bps)
  const net = Math.max(0, gross - fee)
  return { gross, fee, net, bps }
}

export function feePercentLabel(bps: number): string {
  return (bps / 100).toFixed(2)
}
