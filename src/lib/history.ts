/**
 * Local record of bridges this browser has created.
 *
 * The upstream exposes status per order id but has no "my orders" endpoint, so
 * the id has to be kept client-side or the user loses the order the moment the
 * tab closes.
 */
const KEY = 'riddle.bridge.history'
const MAX_RECORDS = 50

export interface BridgeRecord {
  id: string
  createdAt: number
  fromCurrency: string
  fromNetwork: string
  toCurrency: string
  toNetwork: string
  /** Deposit amount actually bridged (net of the platform cut) */
  amount: number
  /** Estimated destination amount at creation time */
  toAmount: number
  payinAddress: string
  destination: string
  /** Step 1 — platform fee transfer */
  feeTxId?: string | null
  feeAmount?: number | null
  /** Step 2 — bridge deposit transfer */
  depositTxId?: string | null
  /** Last known upstream status */
  status?: string | null
  updatedAt?: number
}

function read(): BridgeRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? (data as BridgeRecord[]).filter((r) => r && r.id) : []
  } catch {
    return []
  }
}

function write(records: BridgeRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  } catch {
    /* private mode or quota — history is best-effort */
  }
}

export function listBridges(): BridgeRecord[] {
  return read().sort((a, b) => b.createdAt - a.createdAt)
}

/** Insert or merge by order id, newest first. */
export function saveBridge(record: BridgeRecord): BridgeRecord[] {
  const all = read()
  const i = all.findIndex((r) => r.id === record.id)
  if (i >= 0) all[i] = { ...all[i], ...record, updatedAt: Date.now() }
  else all.unshift({ ...record, updatedAt: Date.now() })
  const sorted = all.sort((a, b) => b.createdAt - a.createdAt)
  write(sorted)
  return sorted
}

export function patchBridge(id: string, patch: Partial<BridgeRecord>): BridgeRecord[] {
  const all = read()
  const i = all.findIndex((r) => r.id === id)
  if (i < 0) return all
  all[i] = { ...all[i], ...patch, updatedAt: Date.now() }
  write(all)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export function removeBridge(id: string): BridgeRecord[] {
  const next = read().filter((r) => r.id !== id)
  write(next)
  return next
}

export function clearBridges(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
