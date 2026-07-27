/**
 * Routes a created order's deposit to the wallet stack that can sign it.
 *
 * XRP has two paths: the connected Joey Wallet signs over WalletConnect, and
 * the Xaman deep link stays available as the no-connection fallback (handled
 * in the deposit UI, not here).
 */
import { useCallback, useMemo } from 'react'
import { useAppKitProvider } from '@reown/appkit/react'
import type { Provider as SolanaProvider } from '@reown/appkit-utils/solana'
import { Connection } from '@solana/web3.js'
import { solanaRpcUrl } from '../lib/wallet/appkit'
import { depositAmount, depositTag } from '../domain/bridge'
import { evmChainIdFor, walletFamilyFor } from '../lib/wallet/networks'
import { payEvm } from '../lib/pay/evm'
import { paySolana } from '../lib/pay/solana'
import { payXrpl } from '../lib/wallet/xrpl'
import { payStellar } from '../lib/wallet/stellar'
import type { BridgeCreateResult, BridgeCurrency } from '../types'
import type { WalletAddresses } from './useWallet'

export interface PayResult {
  /** Chain transaction id — hash on EVM/XRPL, signature on Solana. */
  txId: string
  network: string
}

interface Options {
  /** False when the XRPL address came from Xaman, which has no signing session. */
  xrplCanSign: boolean
}

export function usePayDeposit(addresses: WalletAddresses, { xrplCanSign }: Options) {
  const { walletProvider: solanaProvider } = useAppKitProvider<SolanaProvider>('solana')

  /**
   * Our own Connection on a verified endpoint rather than the adapter's
   * default, which has been seen to answer getLatestBlockhash with 403 and so
   * fail every send.
   */
  const connection = useMemo(() => new Connection(solanaRpcUrl, 'confirmed'), [])

  const canPay = useCallback(
    (from: BridgeCurrency | null): boolean => {
      const family = walletFamilyFor(from?.network)
      if (!family) return false
      if (family === 'solana') return Boolean(addresses.solana && solanaProvider)
      if (family === 'stellar') return Boolean(addresses.stellar)
      if (family === 'xrpl') return Boolean(addresses.xrpl && xrplCanSign)
      return Boolean(addresses[family])
    },
    [addresses, solanaProvider, xrplCanSign],
  )

  /**
   * Send an arbitrary amount on the source chain — used for both the platform
   * fee (step 1) and the bridge deposit (step 2), so the two share one signing
   * path per chain.
   */
  const send = useCallback(
    async (
      from: BridgeCurrency,
      to: string,
      amount: number | string,
      memo: string | null,
    ): Promise<PayResult> => {
      const family = walletFamilyFor(from.network)
      if (!family) {
        throw new Error(`No wallet support for ${from.network.toUpperCase()} — send manually`)
      }
      if (!to) throw new Error('No destination address')

      if (family === 'eip155') {
        const chainId = evmChainIdFor(from.network)
        if (chainId == null) throw new Error(`Unsupported EVM network: ${from.network}`)
        if (!addresses.eip155) throw new Error('Connect an EVM wallet first')
        const txId = await payEvm({ chainId, to, amount, tokenContract: from.tokenContract })
        return { txId, network: from.network }
      }

      if (family === 'solana') {
        if (!addresses.solana) throw new Error('Connect a Solana wallet first')
        if (!solanaProvider) throw new Error('Solana provider is not ready')
        const txId = await paySolana({
          provider: solanaProvider,
          connection,
          from: addresses.solana,
          to,
          amount,
          tokenMint: from.tokenContract,
          memo,
        })
        return { txId, network: from.network }
      }

      if (family === 'stellar') {
        if (!addresses.stellar) throw new Error('Connect a Stellar wallet first')
        const { hash } = await payStellar({
          from: addresses.stellar,
          destination: to,
          amount,
          memo,
          tokenContract: from.tokenContract,
        })
        return { txId: hash, network: from.network }
      }

      if (!addresses.xrpl || !xrplCanSign) {
        throw new Error('Connect Joey Wallet to sign — Xaman pays via its deep link')
      }
      const { hash } = await payXrpl({
        from: addresses.xrpl,
        destination: to,
        amountXrp: amount,
        destinationTag: memo,
      })
      if (!hash) throw new Error('Wallet signed the payment but returned no transaction hash')
      return { txId: hash, network: from.network }
    },
    [addresses, connection, solanaProvider, xrplCanSign],
  )

  /** Step 1 — platform fee to the chain's fee wallet. */
  const payFee = useCallback(
    (from: BridgeCurrency, feeAddress: string, amount: number | string) =>
      send(from, feeAddress, amount, null),
    [send],
  )

  const pay = useCallback(
    async (order: BridgeCreateResult, from: BridgeCurrency): Promise<PayResult> => {
      const family = walletFamilyFor(from.network)
      if (!family) {
        throw new Error(`No wallet support for ${from.network.toUpperCase()} — send manually`)
      }

      const amount = depositAmount(order)
      const tag = depositTag(order)
      const to = order.payinAddress.trim()
      if (!to) throw new Error('Order has no deposit address')

      if (family === 'eip155') {
        const chainId = evmChainIdFor(from.network)
        if (chainId == null) throw new Error(`Unsupported EVM network: ${from.network}`)
        if (!addresses.eip155) throw new Error('Connect an EVM wallet first')
        const txId = await payEvm({
          chainId,
          to,
          amount,
          tokenContract: from.tokenContract,
        })
        return { txId, network: from.network }
      }

      if (family === 'solana') {
        if (!addresses.solana) throw new Error('Connect a Solana wallet first')
        if (!solanaProvider) throw new Error('Solana provider is not ready')
        const txId = await paySolana({
          provider: solanaProvider,
          connection,
          from: addresses.solana,
          to,
          amount,
          tokenMint: from.tokenContract,
          memo: tag,
        })
        return { txId, network: from.network }
      }

      if (family === 'stellar') {
        if (!addresses.stellar) throw new Error('Connect a Stellar wallet first')
        const { hash } = await payStellar({
          from: addresses.stellar,
          destination: to,
          amount,
          memo: tag,
          tokenContract: from.tokenContract,
        })
        return { txId: hash, network: from.network }
      }

      if (!addresses.xrpl || !xrplCanSign) {
        throw new Error('Connect Joey Wallet to sign — Xaman pays via its deep link')
      }
      const { hash } = await payXrpl({
        from: addresses.xrpl,
        destination: to,
        amountXrp: amount,
        destinationTag: tag,
      })
      if (!hash) throw new Error('Wallet signed the payment but returned no transaction hash')
      return { txId: hash, network: from.network }
    },
    [addresses, connection, solanaProvider, xrplCanSign],
  )

  return { pay, payFee, canPay }
}
