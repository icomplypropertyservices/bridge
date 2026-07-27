import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Plus, Wallet } from 'lucide-react'
import { shortAddr } from '../lib/format'
import { WALLET_KINDS, type WalletApi, type WalletKind } from '../hooks/useWallet'

const KIND_LABEL: Record<WalletKind, string> = {
  eip155: 'Ethereum / EVM',
  solana: 'Solana',
  stellar: 'Stellar',
  joey: 'Joey Wallet',
  xaman: 'Xaman',
}

const KIND_HINT: Record<WalletKind, string> = {
  eip155: 'MetaMask, Rainbow, Trust · WalletConnect',
  solana: 'Phantom, Solflare · WalletConnect',
  stellar: 'LOBSTR · WalletConnect',
  joey: 'XRP Ledger · WalletConnect',
  xaman: 'XRP Ledger · Sign-In + deep link',
}

interface Props {
  wallet: WalletApi
  /** Hidden when the server has no Xaman credentials */
  xamanAvailable: boolean
}

export default function WalletMenu({ wallet, xamanAvailable }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const { kindAddresses, connectedKinds, anyConnected } = wallet
  const primary = connectedKinds[0]
  const kinds = WALLET_KINDS.filter((k) => k !== 'xaman' || xamanAvailable)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={anyConnected ? 'btn-ghost' : 'btn-primary !py-2.5'}
        onClick={() => setOpen((v) => !v)}
      >
        <Wallet className={`h-4 w-4 ${anyConnected ? 'text-emerald-400' : ''}`} />
        {anyConnected && primary ? (
          <span className="font-mono text-xs">
            {shortAddr(kindAddresses[primary])}
            {connectedKinds.length > 1 && (
              <span className="ml-1 text-riddle-muted">+{connectedKinds.length - 1}</span>
            )}
          </span>
        ) : (
          'Connect Wallet'
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 z-[90] mt-2 w-[20rem] rounded-2xl border border-riddle-border bg-[#0b0b12] p-2 shadow-2xl">
          {kinds.map((kind) => {
            const addr = kindAddresses[kind]
            const busy =
              (kind === 'joey' && wallet.xrplConnecting) ||
              (kind === 'stellar' && wallet.stellarConnecting) ||
              (kind === 'xaman' && wallet.xaman.connecting)
            return (
              <div key={kind} className="flex items-center gap-2 rounded-xl p-2 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{KIND_LABEL[kind]}</div>
                  {addr ? (
                    <div className="font-mono text-[11px] text-emerald-400">
                      {shortAddr(addr, 10, 6)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-riddle-muted">{KIND_HINT[kind]}</div>
                  )}
                </div>

                {addr ? (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5"
                    title={`Disconnect ${KIND_LABEL[kind]}`}
                    onClick={() => void wallet.disconnectKind(kind)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5"
                    disabled={busy}
                    onClick={() => {
                      wallet.connectKind(kind)
                      setOpen(false)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-xs">{busy ? '…' : 'Connect'}</span>
                  </button>
                )}
              </div>
            )
          })}

          {anyConnected && (
            <>
              <div className="my-1 border-t border-white/5" />
              <button
                type="button"
                className="w-full rounded-xl p-2 text-left text-sm text-rose-300 hover:bg-white/5"
                onClick={() => {
                  void wallet.disconnectAll()
                  setOpen(false)
                }}
              >
                Disconnect all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
