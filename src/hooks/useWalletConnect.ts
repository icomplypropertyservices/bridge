import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createXamanPayload, pollXamanPayload } from '../lib/api'
import { isMobileUa, openXamanUrls, signInUrls } from '../lib/xaman'
import { shortAddr } from '../lib/format'
import type { ConnectStatus, XummPayloadResponse } from '../types'

const PENDING_KEY = 'riddle.xaman.pending'
const ADDRESS_KEY = 'riddle.xaman.address'

type PendingConnect = {
  uuid: string
  createdAt: number
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function readPending(): PendingConnect | null {
  try {
    const raw = storageGet(PENDING_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PendingConnect
    if (!data?.uuid || !data?.createdAt) return null
    if (Date.now() - data.createdAt > 8 * 60 * 1000) {
      storageRemove(PENDING_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function writePending(uuid: string) {
  storageSet(
    PENDING_KEY,
    JSON.stringify({ uuid, createdAt: Date.now() } satisfies PendingConnect),
  )
}

function clearPending() {
  storageRemove(PENDING_KEY)
}

function readStoredAddress(): string {
  return storageGet(ADDRESS_KEY) || ''
}

function writeStoredAddress(addr: string) {
  if (addr) storageSet(ADDRESS_KEY, addr)
  else storageRemove(ADDRESS_KEY)
}

function stripXamanQuery() {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('xaman')) return
    u.searchParams.delete('xaman')
    const qs = u.searchParams.toString()
    window.history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : '') + u.hash)
  } catch {
    /* ignore */
  }
}

/**
 * Connect Wallet via Xaman Sign-In:
 * - desktop → QR modal + poll
 * - mobile → open Xaman; return_url lands on same origin; localStorage uuid resumes poll
 */
export function useWalletConnect() {
  const [address, setAddress] = useState(() => readStoredAddress())
  const [connecting, setConnecting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [payload, setPayload] = useState<XummPayloadResponse | null>(null)
  const [status, setStatus] = useState<ConnectStatus>(() =>
    readStoredAddress() ? 'signed' : 'idle',
  )

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)
  const uuidRef = useRef<string | null>(null)
  const resumedRef = useRef(false)

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    inFlightRef.current = false
  }, [])

  const closeModal = useCallback(() => {
    clearPoll()
    setModalOpen(false)
    setConnecting(false)
    if (status === 'pending') setStatus('idle')
  }, [clearPoll, status])

  const finishSigned = useCallback(
    (acc: string) => {
      clearPoll()
      clearPending()
      stripXamanQuery()
      uuidRef.current = null
      writeStoredAddress(acc)
      setAddress(acc)
      setStatus('signed')
      setConnecting(false)
      setModalOpen(false)
      toast.success(`Connected ${shortAddr(acc)}`)
    },
    [clearPoll],
  )

  const startPoll = useCallback(
    (uuid: string) => {
      clearPoll()
      uuidRef.current = uuid
      writePending(uuid)
      let attempts = 0
      const maxAttempts = 120
      const deadline = Date.now() + 4 * 60 * 1000

      const tick = async () => {
        if (inFlightRef.current) return
        inFlightRef.current = true
        attempts += 1
        try {
          if (Date.now() > deadline || attempts > maxAttempts) {
            clearPoll()
            clearPending()
            setStatus('rejected')
            setConnecting(false)
            toast.error('Connect timed out — try again')
            return
          }

          const s = await pollXamanPayload(uuid)
          if (s.meta?.signed) {
            const acc = s.response?.account
            if (acc) finishSigned(acc)
            else {
              clearPoll()
              clearPending()
              setStatus('rejected')
              setConnecting(false)
              toast.error('Signed but no account returned')
            }
          } else if (s.meta?.cancelled || s.meta?.expired) {
            clearPoll()
            clearPending()
            stripXamanQuery()
            setStatus(s.meta.expired ? 'expired' : 'rejected')
            setConnecting(false)
            toast.error(s.meta.expired ? 'Request expired' : 'Connection cancelled')
          }
        } catch {
          /* keep polling */
        } finally {
          inFlightRef.current = false
        }
      }

      pollRef.current = setInterval(() => void tick(), 1600)
      void tick()
    },
    [clearPoll, finishSigned],
  )

  // Resume after mobile return_url (fresh load) or unfinished pending session
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true

    if (readStoredAddress()) {
      clearPending()
      stripXamanQuery()
      return
    }

    // ?xaman=1 is a return marker; ?xaman=<uuid> is a direct resume hint
    let uuid: string | null = null
    try {
      const q = new URL(window.location.href).searchParams.get('xaman')
      if (q && q !== '1' && q.length > 8) uuid = q
    } catch {
      /* ignore */
    }
    if (!uuid) uuid = readPending()?.uuid ?? null
    // Landing from return_url with only marker still uses pending uuid
    if (!uuid) return

    setConnecting(true)
    setStatus('pending')
    setModalOpen(!isMobileUa())
    startPoll(uuid)
  }, [startPoll])

  // Immediate status check when returning from Xaman to an existing tab
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      const uuid = uuidRef.current || readPending()?.uuid
      if (!uuid || readStoredAddress()) return
      void pollXamanPayload(uuid)
        .then((s) => {
          if (s.meta?.signed && s.response?.account) finishSigned(s.response.account)
        })
        .catch(() => {
          /* ignore */
        })
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [finishSigned])

  const connect = useCallback(async () => {
    if (connecting) return
    setConnecting(true)
    setStatus('pending')
    setPayload(null)
    clearPoll()

    try {
      // return_url = same origin (path only). uuid is stored in localStorage so
      // when Xaman reloads this page after sign, we resume polling and pick up
      // the signed account. Also accept ?xaman=uuid if present (manual links).
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}?xaman=1`
          : undefined

      const data = await createXamanPayload({
        txjson: { TransactionType: 'SignIn' },
        options: {
          expire: 5,
          return_url: {
            app: returnUrl,
            web: returnUrl,
          },
        },
        custom_meta: {
          instruction: 'Connect to Riddle Bridge',
        },
      })

      // Store real uuid under pending; ?xaman=1 is only a return marker
      writePending(data.uuid)
      setPayload(data)
      setModalOpen(true)

      openXamanUrls(signInUrls(data.uuid, data.next?.always))
      startPoll(data.uuid)
    } catch (e) {
      setConnecting(false)
      setStatus('idle')
      toast.error(e instanceof Error ? e.message : 'Could not start Connect Wallet')
    }
  }, [connecting, clearPoll, startPoll])

  const openDeepLink = useCallback(() => {
    if (!payload) return
    openXamanUrls(signInUrls(payload.uuid, payload.next?.always))
  }, [payload])

  const disconnect = useCallback(() => {
    clearPoll()
    clearPending()
    writeStoredAddress('')
    uuidRef.current = null
    setAddress('')
    setPayload(null)
    setStatus('idle')
    setModalOpen(false)
    setConnecting(false)
    toast.info('Disconnected')
  }, [clearPoll])

  return {
    address,
    connecting,
    modalOpen,
    payload,
    status,
    connect,
    disconnect,
    closeModal,
    openDeepLink,
    setAddress,
  }
}
