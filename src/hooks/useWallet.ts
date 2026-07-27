/**
 * One wallet facade over two stacks:
 * - EVM + Solana  → Reown AppKit (its own modal handles wallet choice + QR)
 * - XRPL          → UniversalProvider (Joey Wallet), with our QR/deep-link modal
 *
 * Replaces the old Xaman Sign-In connect flow. The Xaman *deposit deep link*
 * is unrelated and still lives in lib/xaman.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'
import { shortAddr } from '../lib/format'
import { walletFamilyFor, type WalletFamily } from '../lib/wallet/networks'
import {
  connectXrpl,
  disconnectXrpl,
  getXrplProvider,
  restoreXrplSession,
  xrplAccountFrom,
} from '../lib/wallet/xrpl'
import { joeyDeepLink } from '../lib/wallet/joey'

export interface WalletAddresses {
  eip155: string
  solana: string
  xrpl: string
}

export function useWallet() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const evm = useAppKitAccount({ namespace: 'eip155' })
  const sol = useAppKitAccount({ namespace: 'solana' })

  const [xrplAddress, setXrplAddress] = useState('')
  const [xrplUri, setXrplUri] = useState('')
  const [joeyHref, setJoeyHref] = useState('')
  const [xrplConnecting, setXrplConnecting] = useState(false)
  // Tracks the in-flight pairing independently of the modal, which the user
  // can dismiss while the wallet request is still open.
  const pairingRef = useRef(false)

  // Restore a previously approved XRPL session without prompting the wallet.
  useEffect(() => {
    let cancelled = false
    void restoreXrplSession().then((addr) => {
      if (!cancelled && addr) setXrplAddress(addr)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Wallet-side disconnects and account switches must not leave a stale address.
  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined

    void getXrplProvider()
      .then((provider) => {
        if (disposed) return
        const onDelete = () => setXrplAddress('')
        const onUpdate = () => setXrplAddress(xrplAccountFrom(provider.session))
        provider.on('session_delete', onDelete)
        provider.on('session_update', onUpdate)
        cleanup = () => {
          provider.removeListener('session_delete', onDelete)
          provider.removeListener('session_update', onUpdate)
        }
      })
      .catch(() => {
        /* provider unavailable — nothing to unsubscribe */
      })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  const addresses = useMemo<WalletAddresses>(
    () => ({
      eip155: evm.address || '',
      solana: sol.address || '',
      xrpl: xrplAddress,
    }),
    [evm.address, sol.address, xrplAddress],
  )

  const connectedFamilies = useMemo(
    () =>
      (['eip155', 'solana', 'xrpl'] as WalletFamily[]).filter((f) => Boolean(addresses[f])),
    [addresses],
  )

  const anyConnected = connectedFamilies.length > 0

  /** Address able to sign on a given bridge network, or '' when none. */
  const addressForNetwork = useCallback(
    (network?: string | null): string => {
      const family = walletFamilyFor(network)
      return family ? addresses[family] : ''
    },
    [addresses],
  )

  /**
   * Dismiss the pairing UI. The underlying connect promise stays pending on
   * purpose — if the user approves in the wallet afterwards the session still
   * lands, it just does so without the modal in the way.
   */
  const closeJoeyModal = useCallback(() => {
    setXrplUri('')
    setJoeyHref('')
    setXrplConnecting(false)
  }, [])

  const connectJoey = useCallback(async () => {
    if (pairingRef.current) return
    pairingRef.current = true
    setXrplConnecting(true)
    setXrplUri('')
    setJoeyHref('')
    try {
      const addr = await connectXrpl((uri) => {
        setXrplUri(uri)
        void joeyDeepLink(uri).then(setJoeyHref)
      })
      setXrplAddress(addr)
      toast.success(`XRPL connected ${shortAddr(addr)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Try again'
      // A user closing the wallet sheet surfaces as a rejection — not an error worth shouting about.
      if (/reject|cancel|closed|denied/i.test(msg)) toast.info('Connection cancelled')
      else toast.error('Joey Wallet connect failed', { description: msg })
    } finally {
      pairingRef.current = false
      setXrplConnecting(false)
      setXrplUri('')
      setJoeyHref('')
    }
  }, [])

  const connectFamily = useCallback(
    (family: WalletFamily) => {
      if (family === 'xrpl') {
        void connectJoey()
        return
      }
      void open({ view: 'Connect', namespace: family })
    },
    [connectJoey, open],
  )

  const disconnectFamily = useCallback(
    async (family: WalletFamily) => {
      if (family === 'xrpl') {
        await disconnectXrpl()
        setXrplAddress('')
        toast.info('XRPL wallet disconnected')
        return
      }
      await disconnect({ namespace: family })
      toast.info(family === 'solana' ? 'Solana wallet disconnected' : 'EVM wallet disconnected')
    },
    [disconnect],
  )

  const disconnectAll = useCallback(async () => {
    const tasks: Promise<unknown>[] = []
    if (addresses.eip155) tasks.push(disconnect({ namespace: 'eip155' }))
    if (addresses.solana) tasks.push(disconnect({ namespace: 'solana' }))
    if (addresses.xrpl) tasks.push(disconnectXrpl().then(() => setXrplAddress('')))
    await Promise.allSettled(tasks)
    toast.info('Disconnected')
  }, [addresses, disconnect])

  /** Open AppKit's account view (network switch, balance, disconnect). */
  const openAccount = useCallback(() => {
    void open({ view: 'Account' })
  }, [open])

  return {
    addresses,
    connectedFamilies,
    anyConnected,
    addressForNetwork,
    connectFamily,
    disconnectFamily,
    disconnectAll,
    openAccount,
    // Joey / XRPL pairing modal
    xrplConnecting,
    xrplUri,
    joeyHref,
    closeJoeyModal,
  }
}

export type WalletApi = ReturnType<typeof useWallet>
