export interface BridgeCurrency {
  ticker: string
  name: string
  image?: string
  hasExternalId?: boolean
  isExtraIdSupported?: boolean
  isFiat?: boolean
  featured?: boolean
  isStable?: boolean
  supportsFixedRate?: boolean
  network: string
  tokenContract?: string | null
  buy?: boolean
  sell?: boolean
  legacyTicker?: string
}

/** @deprecated Prefer domain QuoteView + UpstreamEstimate for Sell XRP */
export interface BridgeEstimate {
  fromCurrency: string
  fromNetwork?: string
  toCurrency: string
  toNetwork?: string
  flow?: string
  type?: string
  rateId?: string | null
  validUntil?: string | null
  transactionSpeedForecast?: string | null
  warningMessage?: string | null
  depositFee?: number
  withdrawalFee?: number
  fromAmount: number
  toAmount: number
}

export interface BridgeMinAmount {
  fromCurrency: string
  fromNetwork?: string
  toCurrency: string
  toNetwork?: string
  flow?: string
  minAmount: number
}

export interface BridgeCreateResult {
  id: string
  fromAmount: number
  toAmount: number
  directedAmount?: number
  flow?: string
  type?: string
  payinAddress: string
  payoutAddress: string
  payinExtraId?: string | null
  payinExtraIdName?: string | null
  payoutExtraId?: string | null
  fromCurrency: string
  toCurrency: string
  fromNetwork?: string
  toNetwork?: string
  refundAddress?: string | null
  status?: string
}

export interface BridgeStatus {
  id: string
  status: string
  actionsAvailable?: boolean
  fromCurrency?: string
  fromNetwork?: string
  toCurrency?: string
  toNetwork?: string
  expectedAmountFrom?: number
  expectedAmountTo?: number
  amountFrom?: number | null
  amountTo?: number | null
  payinAddress?: string
  payoutAddress?: string
  payinExtraId?: string | null
  payoutExtraId?: string | null
  refundAddress?: string | null
  createdAt?: string
  updatedAt?: string
  validUntil?: string | null
  depositReceivedAt?: string | null
  payinHash?: string | null
  payoutHash?: string | null
  refundHash?: string | null
  refundAmount?: number | null
}

export interface ValidateAddressResult {
  result: boolean
  isActivated?: boolean | null
  message?: string | null
}

export interface AppConfig {
  platformFeeBps: number
  platformFeePercent: string
  brand: string
  bridgeReady?: boolean
  /** A bridge API key is configured — absent means low upstream rate limits */
  bridgeKeyed?: boolean
  /** Server holds Xaman Platform credentials — Sign-In can be offered */
  xamanReady?: boolean
}

export interface XummPayloadResponse {
  uuid: string
  refs?: {
    qr_png?: string
    qr_matrix?: string
    websocket_status?: string
  }
  next?: {
    always?: string
    no_push_msg_received?: string
  }
  pushed?: boolean
}

export interface XummPayloadStatus {
  meta: {
    signed?: boolean
    cancelled?: boolean
    expired?: boolean
    resolved?: boolean
  }
  response?: {
    account?: string
    txid?: string
    hex?: string
  }
}

export type ConnectStatus = 'idle' | 'pending' | 'signed' | 'rejected' | 'expired'

export function currencyKey(c: Pick<BridgeCurrency, 'ticker' | 'network' | 'legacyTicker'>): string {
  return `${c.ticker}::${c.network}::${c.legacyTicker || c.ticker}`
}
