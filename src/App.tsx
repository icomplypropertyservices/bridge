import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toaster } from 'sonner'
import Header from './components/Header'
import BridgeForm from './components/BridgeForm'
import DepositPanel from './components/DepositPanel'
import StatusPanel from './components/StatusPanel'
import SettingsDrawer from './components/SettingsDrawer'
import JoeyConnectModal from './components/JoeyConnectModal'
import XamanConnectModal from './components/XamanConnectModal'
import { useCurrencies } from './hooks/useCurrencies'
import { useEstimate } from './hooks/useEstimate'
import { useBridgeStatus } from './hooks/useBridgeStatus'
import { useBridgeFlow } from './hooks/useBridgeFlow'
import { useWallet } from './hooks/useWallet'
import { usePayDeposit } from './hooks/usePayDeposit'
import { fetchConfig } from './lib/api'
import { DEFAULT_FEE_BPS } from './lib/fee'
import { walletConnectConfigured } from './lib/wallet/appkit'
import { walletFamilyFor } from './lib/wallet/networks'
import type { AppConfig, BridgeCreateResult, BridgeCurrency } from './types'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const feeBps = config?.platformFeeBps ?? DEFAULT_FEE_BPS
  const feePercent = config?.platformFeePercent ?? (feeBps / 100).toFixed(2)

  const {
    options,
    featuredChips,
    defaults,
    loading: currenciesLoading,
    error: currenciesError,
    count: currencyCount,
  } = useCurrencies()

  const [from, setFrom] = useState<BridgeCurrency | null>(null)
  const [to, setTo] = useState<BridgeCurrency | null>(null)
  const [amount, setAmount] = useState('50')
  const [destination, setDestination] = useState('')
  const [bridgeId, setBridgeId] = useState<string | null>(null)
  const [order, setOrder] = useState<BridgeCreateResult | null>(null)

  const wallet = useWallet()
  const { pay, canPay } = usePayDeposit(wallet.addresses, { xrplCanSign: wallet.xrplCanSign })

  const { quote, minAmount, loading: estimateLoading, error: estimateError } = useEstimate(
    from,
    to,
    amount,
    feeBps,
  )
  const { status, polling } = useBridgeStatus(bridgeId)

  const sourceWallet = wallet.addressForNetwork(from?.network)
  const destinationWallet = wallet.addressForNetwork(to?.network)

  const onCreated = useCallback((result: BridgeCreateResult) => {
    setOrder(result)
    setBridgeId(result.id)
  }, [])

  const flow = useBridgeFlow({
    from,
    to,
    amount,
    destination,
    feeBps,
    minAmount,
    refundAddress: sourceWallet,
    onCreated,
    pay,
    canPay,
  })

  useEffect(() => {
    void fetchConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (!from && defaults.from) setFrom(defaults.from)
    if (!to && defaults.to) setTo(defaults.to)
  }, [defaults.from, defaults.to, from, to])

  const swap = useCallback(() => {
    setFrom(to)
    setTo(from)
    setDestination('')
  }, [from, to])

  const connectSource = useCallback(() => {
    const family = walletFamilyFor(from?.network)
    if (family) wallet.connectFamily(family)
  }, [from?.network, wallet])

  const howItWorks = useMemo(
    () => (
      <div className="glass-card p-5 text-sm text-riddle-muted leading-relaxed">
        <div className="mb-2 font-semibold text-zinc-200">How it works</div>
        <ol className="list-decimal space-y-2 pl-4">
          <li>
            Pick what you send and receive (
            {currencyCount > 0 ? currencyCount.toLocaleString() : '1,200+'} assets).
          </li>
          <li>
            <strong className="text-zinc-300">Connect Wallet</strong> — WalletConnect covers
            Ethereum/EVM, Solana and XRPL (Joey Wallet).
          </li>
          <li>Platform cut {feePercent}% reduces the deposit. Estimate + create use the net amount.</li>
          <li>Destination auto-fills from a connected wallet on the receive network.</li>
          <li>
            Confirm → the order is created and your wallet signs the deposit. XRP can also pay via{' '}
            <strong className="text-zinc-300">Xaman</strong>.
          </li>
          <li>Track status until funds arrive.</li>
        </ol>
      </div>
    ),
    [currencyCount, feePercent],
  )

  return (
    <div className="min-h-svh">
      <Toaster theme="dark" position="top-center" richColors closeButton />
      <Header
        wallet={wallet}
        xamanAvailable={config?.xamanReady !== false}
        onOpenSettings={() => setSettingsOpen(true)}
        feePercent={feePercent}
      />

      {!walletConnectConfigured && (
        <div className="mx-auto mb-4 w-full max-w-5xl px-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[12px] text-amber-200">
            <strong>WalletConnect is unconfigured.</strong> Set{' '}
            <code className="text-amber-100">VITE_REOWN_PROJECT_ID</code> from{' '}
            <a
              className="underline"
              href="https://dashboard.reown.com"
              target="_blank"
              rel="noreferrer"
            >
              dashboard.reown.com
            </a>
            . Connections work on localhost only until then.
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {currenciesError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {currenciesError}
            </div>
          )}
          {currenciesLoading && options.length === 0 ? (
            <div className="glass-card p-10 text-center text-riddle-muted">Loading markets…</div>
          ) : (
            <BridgeForm
              options={options}
              featuredChips={featuredChips}
              from={from}
              onFrom={setFrom}
              to={to}
              onTo={setTo}
              onSwap={swap}
              amount={amount}
              onAmount={setAmount}
              destination={destination}
              onDestination={setDestination}
              destinationWallet={destinationWallet}
              sourceWallet={sourceWallet}
              quote={quote}
              minAmount={minAmount}
              estimateLoading={estimateLoading}
              estimateError={estimateError}
              feeBps={feeBps}
              feePercent={feePercent}
              creating={flow.creating}
              paying={flow.paying}
              onSubmit={() => void flow.run()}
              onConnectSource={connectSource}
            />
          )}
        </div>

        <div className="space-y-4">
          {order && (
            <DepositPanel
              order={order}
              from={from}
              sourceWallet={sourceWallet}
              paying={flow.paying}
              onPay={() => {
                if (from) void flow.payOrder(order, from)
              }}
            />
          )}
          <StatusPanel status={status} polling={polling} bridgeId={bridgeId} />
          {!order && howItWorks}
        </div>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-[11px] text-zinc-600">
        Riddle Bridge · Not financial advice
      </footer>

      <JoeyConnectModal
        uri={wallet.xrplUri}
        connecting={wallet.xrplConnecting}
        joeyHref={wallet.joeyHref}
        onClose={wallet.closeJoeyModal}
      />

      <XamanConnectModal
        open={wallet.xaman.modalOpen}
        payload={wallet.xaman.payload}
        status={wallet.xaman.status}
        onClose={wallet.xaman.closeModal}
        onOpenDeepLink={wallet.xaman.openDeepLink}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        feePercent={feePercent}
      />
    </div>
  )
}
