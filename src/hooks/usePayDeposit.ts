/**
 * Routes a created order's deposit to the wallet stack that can sign it.
 *
 * XRP has two paths: the connected Joey Wallet signs over WalletConnect, and
 * the Xaman deep link stays available as the no-connection fallback (handled
 * in the deposit UI, not here).
 */
import { useCallback } from 'react'
import { useAppKitProvider } from '@reown/appkit/react'
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react'
import type { Provider as SolanaProvider } from '@reown/appkit-utils/solana'
import { depositAmount, depositTag } from '../domain/bridge'
import { evmChainIdFor, walletFamilyFor } from '../lib/wallet/networks'
import { payEvm } from '../lib/pay/evm'
import { paySolana } from '../lib/pay/solana'
import { payXrpl } from '../lib/wallet/xrpl'
import type { BridgeCreateResult, BridgeCurrency } from '../types'
import type { WalletAddresses } from './useWallet'

export interface PayResult {
  /** Chain transaction id — hash on EVM/XRPL, signature on Solana. */
  txId: string
  network: string
}

export function usePayDeposit(addresses: WalletAddresses) {
  const { walletProvider: solanaProvider } = useAppKitProvider<SolanaProvider>('solana')
  const { connection } = useAppKitConnection()

  const canPay = useCallback(
    (from: BridgeCurrency | null): boolean => {
      const family = walletFamilyFor(from?.network)
      if (!family) return false
      if (family === 'solana') return Boolean(addresses.solana && solanaProvider && connection)
      return Boolean(addresses[family])
    },
    [addresses, connection, solanaProvider],
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
        if (!solanaProvider || !connection) throw new Error('Solana provider is not ready')
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

      if (!addresses.xrpl) throw new Error('Connect Joey Wallet first')
      const { hash } = await payXrpl({
        from: addresses.xrpl,
        destination: to,
        amountXrp: amount,
        destinationTag: tag,
      })
      if (!hash) throw new Error('Wallet signed the payment but returned no transaction hash')
      return { txId: hash, network: from.network }
    },
    [addresses, connection, solanaProvider],
  )

  return { pay, canPay }
}
