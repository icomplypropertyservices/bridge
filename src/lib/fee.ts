/** Platform fee: 0.85% default (85 bps) */
export const DEFAULT_FEE_BPS = 85

export function feeFromBps(amount: number, bps: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (!Number.isFinite(bps) || bps <= 0) return 0
  return (amount * bps) / 10_000
}

export function netAfterFee(amount: number, bps: number): number {
  return Math.max(0, amount - feeFromBps(amount, bps))
}
