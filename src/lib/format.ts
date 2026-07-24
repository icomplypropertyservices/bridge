export function shortAddr(addr: string, left = 6, right = 4): string {
  if (!addr) return ''
  if (addr.length <= left + right + 2) return addr
  return `${addr.slice(0, left)}…${addr.slice(-right)}`
}

export function formatAmount(n: number | string | null | undefined, maxDecimals = 8): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (!Number.isFinite(num)) return '—'
  if (num === 0) return '0'
  if (Math.abs(num) >= 1_000_000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Math.abs(num) >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: Math.min(6, maxDecimals) })
  // small amounts
  return num.toFixed(Math.min(maxDecimals, 8)).replace(/\.?0+$/, '') || '0'
}

export function isXrplNetwork(network?: string, ticker?: string): boolean {
  const n = (network || '').toLowerCase()
  const t = (ticker || '').toLowerCase()
  return n === 'xrp' || t === 'xrp'
}

export function networkLabel(network: string): string {
  const map: Record<string, string> = {
    xrp: 'XRPL',
    eth: 'Ethereum',
    bsc: 'BNB Chain',
    sol: 'Solana',
    btc: 'Bitcoin',
    matic: 'Polygon',
    arbitrum: 'Arbitrum',
    op: 'Optimism',
    base: 'Base',
    avaxc: 'Avalanche',
    trx: 'TRON',
    ton: 'TON',
    xlm: 'Stellar',
    ada: 'Cardano',
    ltc: 'Litecoin',
    doge: 'Dogecoin',
    zksync: 'zkSync',
    strk: 'Starknet',
    lna: 'Linea',
  }
  return map[network.toLowerCase()] || network.toUpperCase()
}

export function statusTone(status: string): 'good' | 'warn' | 'bad' | 'info' {
  const s = status.toLowerCase()
  if (['finished', 'completed', 'complete', 'success', 'succeeded', 'done'].includes(s)) return 'good'
  if (['failed', 'failure', 'error', 'refunded', 'expired', 'cancelled', 'canceled'].includes(s)) return 'bad'
  if (['waiting', 'confirming', 'exchanging', 'sending', 'verifying', 'pending', 'new'].includes(s)) return 'warn'
  return 'info'
}
