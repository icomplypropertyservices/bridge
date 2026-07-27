/**
 * EVM deposit execution over the connected WalletConnect / injected wallet.
 * Native coin → plain value transfer; token → ERC-20 `transfer`.
 */
import {
  getAccount,
  readContract,
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { erc20Abi, isAddress, parseEther, parseUnits, type Address } from 'viem'
import { wagmiConfig } from '../wallet/appkit'

export interface EvmPayArgs {
  chainId: number
  to: string
  amount: number | string
  /** Empty/null means the chain's native coin. */
  tokenContract?: string | null
}

export function evmAccount(): { address: string; chainId: number | undefined } {
  const acc = getAccount(wagmiConfig)
  return { address: acc.address || '', chainId: acc.chainId }
}

export async function payEvm(args: EvmPayArgs): Promise<string> {
  const to = args.to.trim()
  if (!isAddress(to)) throw new Error(`Invalid destination address: ${to}`)

  const acc = getAccount(wagmiConfig)
  if (!acc.address) throw new Error('No EVM wallet connected')

  // Wallet must be on the deposit chain or the transfer lands on the wrong network.
  if (acc.chainId !== args.chainId) {
    await switchChain(wagmiConfig, { chainId: args.chainId as never })
  }

  const token = (args.tokenContract || '').trim()

  if (!token) {
    return sendTransaction(wagmiConfig, {
      chainId: args.chainId as never,
      to: to as Address,
      value: parseEther(String(args.amount)),
    })
  }

  if (!isAddress(token)) throw new Error(`Invalid token contract: ${token}`)

  const decimals = await readContract(wagmiConfig, {
    chainId: args.chainId as never,
    address: token as Address,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  return writeContract(wagmiConfig, {
    chainId: args.chainId as never,
    address: token as Address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to as Address, parseUnits(String(args.amount), Number(decimals))],
  })
}

export async function waitForEvmTx(hash: string, chainId: number): Promise<void> {
  await waitForTransactionReceipt(wagmiConfig, {
    hash: hash as `0x${string}`,
    chainId: chainId as never,
  })
}
