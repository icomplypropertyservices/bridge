import { useCallback, useEffect, useState } from 'react'
import { fetchBridgeStatus } from '../lib/api'
import {
  clearBridges,
  listBridges,
  patchBridge,
  removeBridge,
  type BridgeRecord,
} from '../lib/history'

/** Statuses that will never change again — no point polling them. */
const TERMINAL = new Set(['finished', 'completed', 'complete', 'failed', 'refunded', 'expired'])

/**
 * Locally-stored bridges, refreshed against the upstream on mount so a returning
 * user sees where each order actually got to.
 */
export function useBridgeHistory() {
  const [records, setRecords] = useState<BridgeRecord[]>(() => listBridges())

  const refresh = useCallback(() => setRecords(listBridges()), [])

  useEffect(() => {
    let cancelled = false
    const pending = listBridges().filter((r) => !TERMINAL.has((r.status || '').toLowerCase()))
    if (pending.length === 0) return

    void (async () => {
      // Sequential on purpose: the upstream rate-limits hard without an API key.
      for (const record of pending.slice(0, 10)) {
        if (cancelled) return
        try {
          const s = await fetchBridgeStatus(record.id)
          if (cancelled) return
          if (s.status && s.status !== record.status) {
            patchBridge(record.id, { status: s.status })
          }
        } catch {
          /* leave the last known status in place */
        }
      }
      if (!cancelled) setRecords(listBridges())
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const remove = useCallback((id: string) => setRecords(removeBridge(id)), [])

  const clear = useCallback(() => {
    clearBridges()
    setRecords([])
  }, [])

  return { records, refresh, remove, clear }
}
