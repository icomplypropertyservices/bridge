import type {
  AppConfig,
  BridgeCreateResult,
  BridgeCurrency,
  BridgeMinAmount,
  BridgeStatus,
  ValidateAddressResult,
  XummPayloadResponse,
  XummPayloadStatus,
} from '../types'
import type { UpstreamEstimate } from '../domain/xrpOut'
import { SOURCE_NETWORK, SOURCE_TICKER } from '../domain/xrpOut'
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
      xamanReady: false,
    }
  }
}

export async function createXamanPayload(
  body: Record<string, unknown>,
): Promise<XummPayloadResponse> {
  const res = await fetch('/api/xaman/payload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parseJson<XummPayloadResponse>(res)
}

export async function pollXamanPayload(uuid: string): Promise<XummPayloadStatus> {
  const res = await fetch(`/api/xaman/payload?uuid=${encodeURIComponent(uuid)}`)
  return parseJson<XummPayloadStatus>(res)
}

export async function fetchCurrencies(): Promise<BridgeCurrency[]> {
  const res = await fetch(`${BRIDGE}/currencies`)
  const data = await parseJson<BridgeCurrency[] | { currencies?: BridgeCurrency[] }>(res)
  if (Array.isArray(data)) return data
  return data.currencies || []
}

/** XRP-out estimate — wire only (net XRP amount). */
export async function fetchSellXrpEstimate(params: {
  toCurrency: string
  toNetwork: string
  netXrp: number | string
}): Promise<UpstreamEstimate> {
  const qs = new URLSearchParams({
    fromCurrency: SOURCE_TICKER,
    toCurrency: params.toCurrency,
    fromAmount: String(params.netXrp),
    fromNetwork: SOURCE_NETWORK,
    toNetwork: params.toNetwork,
  })
  const res = await fetch(`${BRIDGE}/estimate?${qs}`)
  return parseJson<UpstreamEstimate>(res)
}

export async function fetchSellXrpMinAmount(params: {
  toCurrency: string
  toNetwork: string
}): Promise<BridgeMinAmount> {
  const qs = new URLSearchParams({
    fromCurrency: SOURCE_TICKER,
    toCurrency: params.toCurrency,
    fromNetwork: SOURCE_NETWORK,
    toNetwork: params.toNetwork,
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

export async function createSellXrpBridge(body: {
  toCurrency: string
  toNetwork: string
  netXrp: number | string
  address: string
}): Promise<BridgeCreateResult> {
  const res = await fetch(`${BRIDGE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromCurrency: SOURCE_TICKER,
      toCurrency: body.toCurrency,
      fromAmount: body.netXrp,
      address: body.address,
      fromNetwork: SOURCE_NETWORK,
      toNetwork: body.toNetwork,
    }),
  })
  return parseJson<BridgeCreateResult>(res)
}

export async function fetchBridgeStatus(id: string): Promise<BridgeStatus> {
  const qs = new URLSearchParams({ id, transactionId: id })
  const res = await fetch(`${BRIDGE}/status?${qs}`)
  return parseJson<BridgeStatus>(res)
}
