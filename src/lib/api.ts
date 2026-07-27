import type {
  AppConfig,
  BridgeCreateResult,
  BridgeCurrency,
  BridgeMinAmount,
  BridgeStatus,
  ValidateAddressResult,
} from '../types'
import type { UpstreamEstimate } from '../domain/bridge'
import { DEFAULT_FEE_BPS } from './fee'

const BRIDGE = '/v1/bridge'

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text.slice(0, 180) || `Request failed (${res.status})`)
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string }
    throw new Error(err.error || err.message || `Request failed (${res.status})`)
  }
  return data as T
}

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('/api/config')
    if (!res.ok) throw new Error('config')
    return res.json()
  } catch {
    return {
      platformFeeBps: DEFAULT_FEE_BPS,
      platformFeePercent: (DEFAULT_FEE_BPS / 100).toFixed(2),
      brand: 'Riddle Bridge',
      bridgeReady: false,
    }
  }
}

export async function fetchCurrencies(): Promise<BridgeCurrency[]> {
  const res = await fetch(`${BRIDGE}/currencies`)
  const data = await parseJson<BridgeCurrency[] | { currencies?: BridgeCurrency[] }>(res)
  if (Array.isArray(data)) return data
  return data.currencies || []
}

export interface RoutePair {
  fromCurrency: string
  fromNetwork: string
  toCurrency: string
  toNetwork: string
}

/** Estimate for a route — wire only (net amount, after the platform cut). */
export async function fetchEstimate(
  route: RoutePair,
  netAmount: number | string,
): Promise<UpstreamEstimate> {
  const qs = new URLSearchParams({
    fromCurrency: route.fromCurrency,
    toCurrency: route.toCurrency,
    fromAmount: String(netAmount),
    fromNetwork: route.fromNetwork,
    toNetwork: route.toNetwork,
  })
  const res = await fetch(`${BRIDGE}/estimate?${qs}`)
  return parseJson<UpstreamEstimate>(res)
}

export async function fetchMinAmount(route: RoutePair): Promise<BridgeMinAmount> {
  const qs = new URLSearchParams({
    fromCurrency: route.fromCurrency,
    toCurrency: route.toCurrency,
    fromNetwork: route.fromNetwork,
    toNetwork: route.toNetwork,
  })
  const res = await fetch(`${BRIDGE}/min-amount?${qs}`)
  return parseJson<BridgeMinAmount>(res)
}

export async function validateAddress(params: {
  currency: string
  address: string
  network?: string
}): Promise<ValidateAddressResult> {
  const qs = new URLSearchParams({
    currency: params.currency,
    address: params.address,
  })
  if (params.network) qs.set('network', params.network)
  const res = await fetch(`${BRIDGE}/validate-address?${qs}`)
  return parseJson<ValidateAddressResult>(res)
}

export async function createBridge(
  route: RoutePair,
  body: {
    /** Net source amount after the platform cut */
    netAmount: number | string
    /** Destination address on `route.toNetwork` */
    address: string
    /** Where a failed swap is returned, when the source wallet is known */
    refundAddress?: string
  },
): Promise<BridgeCreateResult> {
  const res = await fetch(`${BRIDGE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromCurrency: route.fromCurrency,
      toCurrency: route.toCurrency,
      fromAmount: body.netAmount,
      address: body.address,
      fromNetwork: route.fromNetwork,
      toNetwork: route.toNetwork,
      ...(body.refundAddress ? { refundAddress: body.refundAddress } : {}),
    }),
  })
  return parseJson<BridgeCreateResult>(res)
}

export async function fetchBridgeStatus(id: string): Promise<BridgeStatus> {
  const qs = new URLSearchParams({ id, transactionId: id })
  const res = await fetch(`${BRIDGE}/status?${qs}`)
  return parseJson<BridgeStatus>(res)
}
