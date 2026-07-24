import { useEffect, useState } from 'react'
import { fetchBridgeStatus } from '../lib/api'
import type { BridgeStatus } from '../types'

const TERMINAL = new Set([
  'finished',
  'completed',
  'complete',
  'success',
  'succeeded',
  'done',
  'failed',
  'failure',
  'error',
  'expired',
  'cancelled',
  'canceled',
  'refunded',
])

export function useBridgeStatus(bridgeId: string | null) {
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!bridgeId) {
      setStatus(null)
      setPolling(false)
      return
    }

    let cancelled = false
    let inFlight = false
    let attempts = 0
    const maxAttempts = 90
    const started = Date.now()
    const maxMs = 15 * 60 * 1000
    setPolling(true)

    const tick = async () => {
      if (cancelled || inFlight) return
      if (attempts >= maxAttempts || Date.now() - started > maxMs) {
        setPolling(false)
        return
      }
      inFlight = true
      attempts += 1
      try {
        const data = await fetchBridgeStatus(bridgeId)
        if (!cancelled) {
          setStatus(data)
          const s = String(data.status || '').toLowerCase()
          if (s && TERMINAL.has(s)) setPolling(false)
        }
      } catch {
        /* keep polling */
      } finally {
        inFlight = false
      }
    }

    void tick()
    const iv = setInterval(() => {
      if (!cancelled) void tick()
    }, 7000)

    return () => {
      cancelled = true
      clearInterval(iv)
      setPolling(false)
    }
  }, [bridgeId])

  return { status, polling, setStatus }
}
