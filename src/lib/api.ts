import type {
  AppConfig,
  BridgeCreateResult,
  BridgeCurrency,
  BridgeEstimate,
  BridgeMinAmount,
  BridgeStatus,
  ValidateAddressResult,
  XummPayloadResponse,
  XummPayloadStatus,
} from '../types'
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

/** Create Sign-In (or other) payload via server — keys stay on server. */
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

export async function fetchEstimate(params: {
  fromCurrency: string
  toCurrency: string
  fromAmount: string | number
  fromNetwork?: string
  toNetwork?: string
}): Promise<BridgeEstimate> {
  const qs = new URLSearchParams({
    fromCurrency: params.fromCurrency,
    toCurrency: params.toCurrency,
    fromAmount: String(params.fromAmount),
  })
  if (params.fromNetwork) qs.set('fromNetwork', params.fromNetwork)
  if (params.toNetwork) qs.set('toNetwork', params.toNetwork)

  const res = await fetch(`${BRIDGE}/estimate?${qs}`)
  return parseJson<BridgeEstimate>(res)
}

export async function fetchMinAmount(params: {
  fromCurrency: string
  toCurrency: string
  fromNetwork?: string
  toNetwork?: string
}): Promise<BridgeMinAmount> {
  const qs = new URLSearchParams({
    fromCurrency: params.fromCurrency,
    toCurrency: params.toCurrency,
  })
  if (params.fromNetwork) qs.set('fromNetwork', params.fromNetwork)
  if (params.toNetwork) qs.set('toNetwork', params.toNetwork)
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

export async function createBridge(body: {
  fromCurrency: string
  toCurrency: string
  fromAmount: number | string
  address: string
  refundAddress?: string
  fromNetwork?: string
  toNetwork?: string
}): Promise<BridgeCreateResult> {
  const payload: Record<string, unknown> = {
    fromCurrency: body.fromCurrency,
    toCurrency: body.toCurrency,
    fromAmount: body.fromAmount,
    address: body.address,
  }
  if (body.refundAddress) payload.refundAddress = body.refundAddress
  if (body.fromNetwork) payload.fromNetwork = body.fromNetwork
  if (body.toNetwork) payload.toNetwork = body.toNetwork

  const res = await fetch(`${BRIDGE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJson<BridgeCreateResult>(res)
}

export async function fetchBridgeStatus(id: string): Promise<BridgeStatus> {
  const qs = new URLSearchParams({ id, transactionId: id })
  const res = await fetch(`${BRIDGE}/status?${qs}`)
  return parseJson<BridgeStatus>(res)
}
