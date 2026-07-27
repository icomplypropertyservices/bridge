/**
 * Solana deposit execution over the connected WalletConnect / injected wallet.
 * Native SOL → SystemProgram transfer; SPL token → checked transfer, creating
 * the recipient's associated token account when the exchange has not yet.
 */
import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from '@solana/spl-token'
import type { Provider } from '@reown/appkit-utils/solana'

/** Solana's memo program — some deposit routes carry their tag here. */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

const SOL_DECIMALS = 9

export interface SolanaPayArgs {
  provider: Provider
  connection: Connection
  from: string
  to: string
  amount: number | string
  /** Empty/null means native SOL. */
  tokenMint?: string | null
  memo?: string | null
}

/** Decimal amount → integer base units, without float drift. */
export function toBaseUnits(amount: number | string, decimals: number): bigint {
  const [whole, frac = ''] = String(amount).trim().split('.')
  const padded = frac.padEnd(decimals, '0').slice(0, decimals)
  const digits = `${whole || '0'}${padded}`.replace(/^0+(?=\d)/, '')
  if (!/^\d+$/.test(digits)) throw new Error(`Invalid amount: ${amount}`)
  return BigInt(digits)
}

function toPublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value.trim())
  } catch {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export async function paySolana(args: SolanaPayArgs): Promise<string> {
  const { provider, connection } = args
  const from = toPublicKey(args.from, 'sender address')
  const to = toPublicKey(args.to, 'destination address')
  const mintAddress = (args.tokenMint || '').trim()

  const instructions: TransactionInstruction[] = []

  if (!mintAddress) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: toBaseUnits(args.amount, SOL_DECIMALS),
      }),
    )
  } else {
    const mint = toPublicKey(mintAddress, 'token mint')
    const info = await getMint(connection, mint)
    const fromAta = await getAssociatedTokenAddress(mint, from)
    const toAta = await getAssociatedTokenAddress(mint, to)

    const toAtaInfo = await connection.getAccountInfo(toAta)
    if (!toAtaInfo) {
      instructions.push(createAssociatedTokenAccountInstruction(from, toAta, to, mint))
    }

    instructions.push(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        toAta,
        from,
        toBaseUnits(args.amount, info.decimals),
        info.decimals,
      ),
    )
  }

  const memo = (args.memo || '').trim()
  if (memo) {
    instructions.push(
      new TransactionInstruction({
        keys: [{ pubkey: from, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, 'utf8'),
      }),
    )
  }

  const { blockhash } = await connection.getLatestBlockhash()
  const tx = new Transaction({ feePayer: from, recentBlockhash: blockhash }).add(...instructions)

  return provider.sendTransaction(tx, connection)
}
