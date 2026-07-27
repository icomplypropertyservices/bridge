/**
 * One wallet facade over three stacks:
 * - EVM + Solana → Reown AppKit (its own modal handles wallet choice + QR)
 * - XRPL / Joey  → UniversalProvider on `xrpl:0`, with our QR/deep-link modal
 * - XRPL / Xaman → Platform Sign-In, because Xaman is not in the WalletConnect
 *                  registry and has no WC v2 support
 *
 * Both XRPL wallets yield an r-address, but only Joey holds a signing session:
 * a Xaman connection pays its deposit through the Xaman deep link instead.
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
import { useXamanConnect } from './useXamanConnect'

export interface WalletAddresses {
  eip155: string
  solana: string
  xrpl: string
}

/** Menu-level wallet choice. Two of these share the `xrpl` family. */
export type WalletKind = 'eip155' | 'solana' | 'joey' | 'xaman'

export const WALLET_KINDS: WalletKind[] = ['eip155', 'solana', 'joey', 'xaman']

export function kindFamily(kind: WalletKind): WalletFamily {
  if (kind === 'eip155' || kind === 'solana') return kind
  return 'xrpl'
}

export function useWallet() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const evm = useAppKitAccount({ namespace: 'eip155' })
  const sol = useAppKitAccount({ namespace: 'solana' })
  const xaman = useXamanConnect()

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

  /** Joey wins the XRPL slot when both are connected — only it can sign. */
  const addresses = useMemo<WalletAddresses>(
    () => ({
      eip155: evm.address || '',
      solana: sol.address || '',
      xrpl: xrplAddress || xaman.address,
    }),
    [evm.address, sol.address, xrplAddress, xaman.address],
  )

  const kindAddresses = useMemo<Record<WalletKind, string>>(
    () => ({
      eip155: evm.address || '',
      solana: sol.address || '',
      joey: xrplAddress,
      xaman: xaman.address,
    }),
    [evm.address, sol.address, xrplAddress, xaman.address],
  )

  /** True only when the XRPL address is backed by a signing session (Joey). */
  const xrplCanSign = Boolean(xrplAddress)

  const connectedKinds = useMemo(
    () => WALLET_KINDS.filter((k) => Boolean(kindAddresses[k])),
    [kindAddresses],
  )

  const connectedFamilies = useMemo(
    () => (['eip155', 'solana', 'xrpl'] as WalletFamily[]).filter((f) => Boolean(addresses[f])),
    [addresses],
  )

  const anyConnected = connectedKinds.length > 0

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

  const connectKind = useCallback(
    (kind: WalletKind) => {
      if (kind === 'joey') {
        void connectJoey()
        return
      }
      if (kind === 'xaman') {
        void xaman.connect()
        return
      }
      void open({ view: 'Connect', namespace: kind })
    },
    [connectJoey, open, xaman],
  )

  /** Connect whichever wallet suits a bridge network; XRPL defaults to Joey. */
  const connectFamily = useCallback(
    (family: WalletFamily) => connectKind(family === 'xrpl' ? 'joey' : family),
    [connectKind],
  )

  /**
   * Disconnect must always clear local state, even when the remote teardown
   * fails — otherwise a dead session leaves the UI stuck as "connected" with no
   * way out. Errors are surfaced rather than swallowed.
   */
  const disconnectKind = useCallback(
    async (kind: WalletKind) => {
      try {
        if (kind === 'joey') {
          await disconnectXrpl()
          toast.info('Joey Wallet disconnected')
          return
        }
        if (kind === 'xaman') {
          xaman.disconnect()
          toast.info('Xaman disconnected')
          return
        }
        await disconnect({ namespace: kind })
        toast.info(kind === 'solana' ? 'Solana wallet disconnected' : 'EVM wallet disconnected')
      } catch (e) {
        toast.error('Disconnect failed', {
          description: e instanceof Error ? e.message : 'Session cleared locally',
        })
      } finally {
        if (kind === 'joey') setXrplAddress('')
      }
    },
    [disconnect, xaman],
  )

  const disconnectAll = useCallback(async () => {
    const tasks: Promise<unknown>[] = []
    if (kindAddresses.eip155) tasks.push(disconnect({ namespace: 'eip155' }))
    if (kindAddresses.solana) tasks.push(disconnect({ namespace: 'solana' }))
    if (kindAddresses.joey) tasks.push(disconnectXrpl())
    if (kindAddresses.xaman) xaman.disconnect()

    const results = await Promise.allSettled(tasks)
    setXrplAddress('')

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length) {
      toast.error(`${failed.length} wallet(s) failed to disconnect cleanly`, {
        description: 'Local sessions were cleared anyway',
      })
    } else {
      toast.info('Disconnected')
    }
  }, [kindAddresses, disconnect, xaman])

  /** Open AppKit's account view (network switch, balance, disconnect). */
  const openAccount = useCallback(() => {
    void open({ view: 'Account' })
  }, [open])

  return {
    addresses,
    kindAddresses,
    connectedKinds,
    connectedFamilies,
    anyConnected,
    addressForNetwork,
    /** Only a Joey session can sign XRPL transactions; Xaman uses deep links. */
    xrplCanSign,
    connectKind,
    connectFamily,
    disconnectKind,
    disconnectAll,
    openAccount,
    // Joey / XRPL pairing modal
    xrplConnecting,
    xrplUri,
    joeyHref,
    closeJoeyModal,
    // Xaman Sign-In modal
    xaman,
  }
}

export type WalletApi = ReturnType<typeof useWallet>
