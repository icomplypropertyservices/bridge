/** Block-explorer transaction links, so a sent payment is verifiable. */
const EVM_EXPLORERS: Record<string, string> = {
  eth: 'https://etherscan.io/tx/',
  bsc: 'https://bscscan.com/tx/',
  matic: 'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  op: 'https://optimistic.etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  avaxc: 'https://snowtrace.io/tx/',
  zksync: 'https://explorer.zksync.io/tx/',
  lna: 'https://lineascan.build/tx/',
}

export function txExplorerUrl(network: string | undefined, txId: string): string | null {
  const n = (network || '').toLowerCase()
  if (!txId) return null
  if (n === 'sol') return `https://solscan.io/tx/${txId}`
  if (n === 'xlm') return `https://stellar.expert/explorer/public/tx/${txId}`
  if (n === 'xrp') return `https://livenet.xrpl.org/transactions/${txId}`
  const base = EVM_EXPLORERS[n]
  return base ? `${base}${txId}` : null
}
