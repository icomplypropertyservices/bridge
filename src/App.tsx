import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toaster } from 'sonner'
import Header from './components/Header'
import BridgeForm from './components/BridgeForm'
import DepositPanel from './components/DepositPanel'
import StatusPanel from './components/StatusPanel'
import SettingsDrawer from './components/SettingsDrawer'
import ConnectModal from './components/ConnectModal'
import { useCurrencies } from './hooks/useCurrencies'
import { useEstimate } from './hooks/useEstimate'
import { useBridgeStatus } from './hooks/useBridgeStatus'
import { useBridgeFlow } from './hooks/useBridgeFlow'
import { useWalletConnect } from './hooks/useWalletConnect'
import { fetchConfig } from './lib/api'
import { isXrplNetwork } from './lib/format'
import { DEFAULT_FEE_BPS } from './lib/fee'
import type { AppConfig, BridgeCreateResult, BridgeCurrency } from './types'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const feeBps = config?.platformFeeBps ?? DEFAULT_FEE_BPS
  const feePercent = config?.platformFeePercent ?? (feeBps / 100).toFixed(2)

  const { currencies, defaults, loading: currenciesLoading, error: currenciesError } = useCurrencies()
  const [from, setFrom] = useState<BridgeCurrency | null>(null)
  const [to, setTo] = useState<BridgeCurrency | null>(null)
  const [amount, setAmount] = useState('50')
  const [destination, setDestination] = useState('')
  const [refundAddress, setRefundAddress] = useState('')
  const [bridgeId, setBridgeId] = useState<string | null>(null)
  const [order, setOrder] = useState<BridgeCreateResult | null>(null)

  const wallet = useWalletConnect()

  const { estimate, minAmount, loading: estimateLoading, error: estimateError } = useEstimate(
    from,
    to,
    amount,
    feeBps,
  )
  const { status, polling } = useBridgeStatus(bridgeId)

  const onCreated = useCallback((result: BridgeCreateResult) => {
    setOrder(result)
    setBridgeId(result.id)
  }, [])

  const flow = useBridgeFlow({
    from,
    to,
    amount,
    destination,
    refundAddress,
    walletAddress: wallet.address,
    feeBps,
    minAmount,
    onCreated,
  })

  useEffect(() => {
    void fetchConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (!from && defaults.from) setFrom(defaults.from)
    if (!to && defaults.to) setTo(defaults.to)
  }, [defaults, from, to])

  useEffect(() => {
    if (wallet.address && !refundAddress) setRefundAddress(wallet.address)
  }, [wallet.address, refundAddress])

  const onSwapSides = useCallback(() => {
    setFrom(to)
    setTo(from)
    setDestination('')
  }, [from, to])

  const showXamanDeepLink = useMemo(
    () => Boolean(order && from && isXrplNetwork(from.network, from.ticker)),
    [order, from],
  )

  return (
    <div className="min-h-svh">
      <Toaster theme="dark" position="top-center" richColors closeButton />
      <Header
        address={wallet.address}
        connecting={wallet.connecting}
        onConnect={() => void wallet.connect()}
        onDisconnect={wallet.disconnect}
        onOpenSettings={() => setSettingsOpen(true)}
        feePercent={feePercent}
      />

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {currenciesError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {currenciesError}
            </div>
          )}
          {currenciesLoading && !from ? (
            <div className="glass-card p-10 text-center text-riddle-muted">Loading markets…</div>
          ) : (
            <BridgeForm
              currencies={currencies}
              from={from}
              to={to}
              onFrom={setFrom}
              onTo={setTo}
              onSwapSides={onSwapSides}
              amount={amount}
              onAmount={setAmount}
              destination={destination}
              onDestination={setDestination}
              refundAddress={refundAddress}
              onRefund={setRefundAddress}
              estimate={estimate}
              minAmount={minAmount}
              estimateLoading={estimateLoading}
              estimateError={estimateError}
              feeBps={feeBps}
              feePercent={feePercent}
              creating={flow.creating}
              onSubmit={() => void flow.run()}
              walletAddress={wallet.address}
            />
          )}
        </div>

        <div className="space-y-4">
          {order && (
            <DepositPanel order={order} showXamanDeepLink={showXamanDeepLink} />
          )}
          <StatusPanel status={status} polling={polling} bridgeId={bridgeId} />

          {!order && (
            <div className="glass-card p-5 text-sm text-riddle-muted leading-relaxed">
              <div className="mb-2 font-semibold text-zinc-200">How it works</div>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Pick assets and enter the amount you want to send.</li>
                <li>A {feePercent}% Riddle fee is applied; the rest is bridged.</li>
                <li>
                  <strong className="text-zinc-300">Connect Wallet</strong> with Xaman (QR on web,
                  app on mobile).
                </li>
                <li>Paste destination on the target network (or use your connected refund address).</li>
                <li>
                  Confirm — for XRP, Xaman <strong className="text-zinc-300">deep link</strong> opens
                  for the deposit.
                </li>
                <li>Track live status until funds arrive.</li>
              </ol>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-[11px] text-zinc-600">
        Riddle Bridge · Not financial advice · Always verify addresses and networks
      </footer>

      <ConnectModal
        open={wallet.modalOpen}
        payload={wallet.payload}
        status={wallet.status}
        onClose={wallet.closeModal}
        onOpenDeepLink={wallet.openDeepLink}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        feePercent={feePercent}
      />
    </div>
  )
}
