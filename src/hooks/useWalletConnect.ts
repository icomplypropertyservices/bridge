import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createXamanPayload, pollXamanPayload } from '../lib/api'
import { isMobileUa } from '../lib/xaman'
import { shortAddr } from '../lib/format'
import type { ConnectStatus, XummPayloadResponse } from '../types'

/**
 * Connect Wallet via Xaman Sign-In payload:
 * - mobile → open app deep link
 * - web → show QR
 * - poll until signed / rejected / expired
 */
export function useWalletConnect() {
  const [address, setAddress] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [payload, setPayload] = useState<XummPayloadResponse | null>(null)
  const [status, setStatus] = useState<ConnectStatus>('idle')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

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

  const startPoll = useCallback(
    (uuid: string) => {
      clearPoll()
      let attempts = 0
      const maxAttempts = 90
      const deadline = Date.now() + maxAttempts * 2000

      const tick = async () => {
        if (typeof document !== 'undefined' && document.hidden) return
        if (inFlightRef.current) return
        inFlightRef.current = true
        attempts += 1
        try {
          if (Date.now() > deadline || attempts > maxAttempts) {
            clearPoll()
            setStatus('rejected')
            setConnecting(false)
            toast.error('Connect timed out — try again')
            return
          }

          const s = await pollXamanPayload(uuid)
          if (s.meta?.signed) {
            clearPoll()
            const acc = s.response?.account
            if (acc) {
              setAddress(acc)
              setStatus('signed')
              setConnecting(false)
              setModalOpen(false)
              toast.success(`Connected ${shortAddr(acc)}`)
            } else {
              setStatus('rejected')
              setConnecting(false)
              toast.error('Signed but no account returned')
            }
          } else if (s.meta?.cancelled || s.meta?.expired) {
            clearPoll()
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

      pollRef.current = setInterval(() => void tick(), 1800)
      void tick()
    },
    [clearPoll],
  )

  const connect = useCallback(async () => {
    if (connecting) return
    setConnecting(true)
    setStatus('pending')
    setPayload(null)
    clearPoll()

    try {
      const data = await createXamanPayload({
        txjson: { TransactionType: 'SignIn' },
        options: {
          expire: 5,
          return_url: {
            app: typeof window !== 'undefined' ? window.location.href : undefined,
            web: typeof window !== 'undefined' ? window.location.href : undefined,
          },
        },
        custom_meta: {
          instruction: 'Connect to Riddle Bridge',
        },
      })

      setPayload(data)
      setModalOpen(true)

      const web = data.next?.always || `https://xumm.app/sign/${data.uuid}`
      const native = `xumm://xumm.app/sign/${data.uuid}`

      // Mobile: open Xaman app immediately (user just tapped Connect)
      if (isMobileUa()) {
        try {
          window.location.href = native
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              window.location.href = web
            }
          }, 700)
        } catch {
          /* QR still available in modal */
        }
      }

      startPoll(data.uuid)
    } catch (e) {
      setConnecting(false)
      setStatus('idle')
      toast.error(e instanceof Error ? e.message : 'Could not start Connect Wallet')
    }
  }, [connecting, clearPoll, startPoll])

  const openDeepLink = useCallback(() => {
    if (!payload) return
    const web = payload.next?.always || `https://xumm.app/sign/${payload.uuid}`
    const native = `xumm://xumm.app/sign/${payload.uuid}`
    if (isMobileUa()) {
      window.location.href = native
      setTimeout(() => {
        if (document.visibilityState === 'visible') window.open(web, '_blank', 'noopener,noreferrer')
      }, 600)
    } else {
      window.open(web, '_blank', 'noopener,noreferrer')
    }
  }, [payload])

  const disconnect = useCallback(() => {
    clearPoll()
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
