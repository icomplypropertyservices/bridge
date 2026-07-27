import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Plus, Wallet } from 'lucide-react'
import { shortAddr } from '../lib/format'
import { familyLabel, type WalletFamily } from '../lib/wallet/networks'
import type { WalletApi } from '../hooks/useWallet'

const FAMILIES: WalletFamily[] = ['eip155', 'solana', 'xrpl']

const FAMILY_HINT: Record<WalletFamily, string> = {
  eip155: 'MetaMask, Rainbow, Trust · WalletConnect',
  solana: 'Phantom, Solflare · WalletConnect',
  xrpl: 'Joey Wallet · WalletConnect',
}

interface Props {
  wallet: WalletApi
}

export default function WalletMenu({ wallet }: Props) {
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

  const { addresses, connectedFamilies, anyConnected } = wallet
  const primary = connectedFamilies[0]

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
            {shortAddr(addresses[primary])}
            {connectedFamilies.length > 1 && (
              <span className="ml-1 text-riddle-muted">+{connectedFamilies.length - 1}</span>
            )}
          </span>
        ) : (
          'Connect Wallet'
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 z-[90] mt-2 w-[19rem] rounded-2xl border border-riddle-border bg-[#0b0b12] p-2 shadow-2xl">
          {FAMILIES.map((family) => {
            const addr = addresses[family]
            const isConnecting = family === 'xrpl' && wallet.xrplConnecting
            return (
              <div
                key={family}
                className="flex items-center gap-2 rounded-xl p-2 hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{familyLabel(family)}</div>
                  {addr ? (
                    <div className="font-mono text-[11px] text-emerald-400">
                      {shortAddr(addr, 10, 6)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-riddle-muted">{FAMILY_HINT[family]}</div>
                  )}
                </div>

                {addr ? (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5"
                    title={`Disconnect ${familyLabel(family)}`}
                    onClick={() => void wallet.disconnectFamily(family)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5"
                    disabled={isConnecting}
                    onClick={() => {
                      wallet.connectFamily(family)
                      setOpen(false)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-xs">{isConnecting ? '…' : 'Connect'}</span>
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
