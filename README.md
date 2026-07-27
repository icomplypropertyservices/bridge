# Riddle Bridge

Cross-chain bridge app for the Riddle ecosystem.

- **0.85%** platform fee on every bridge
- **WalletConnect** (Reown AppKit) for Ethereum/EVM and Solana
- **WalletConnect v2 `xrpl:0`** for XRPL — Joey Wallet
- **Xaman deep links** for XRP deposits (`detect/request:…`) — no API key, no connection needed
- Full bridge surface: currencies · estimate · min-amount · create · status · validate-address
- Upstream execution is server-proxied (API key never exposed; partner branding not shown)

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5177

### Environment

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `XRPL_TO_API_KEY` | yes | server | Bridge execution API key |
| `VITE_REOWN_PROJECT_ID` | yes | client | Reown project id for AppKit (EVM + Solana) — [dashboard.reown.com](https://dashboard.reown.com) |
| `VITE_WALLETCONNECT_PROJECT_ID` | optional | client | Project id for the XRPL client; defaults to `VITE_REOWN_PROJECT_ID` |
| `PLATFORM_FEE_BPS` | optional | server | Fee in basis points (default `85` = 0.85%) |

Without `VITE_REOWN_PROJECT_ID` the app falls back to Reown's public localhost
test id, warns in the console, and shows a banner. That id **does not work on a
deployed domain** — wallets verify the requesting origin against the project.

## Wallets

| Chain | Stack | Notes |
|-------|-------|-------|
| Ethereum, BNB, Polygon, Arbitrum, Optimism, Base, Avalanche, zkSync, Linea | Reown AppKit + Wagmi | WalletConnect + injected/EIP-6963 |
| Solana | Reown AppKit + Solana adapter | Native SOL and SPL tokens |
| XRPL | WalletConnect v2 `xrpl:0` via UniversalProvider | Joey Wallet; `xrpl_signTransaction` (`autofill`/`submit` true) |

The XRPL session runs on its own WalletConnect client, isolated from AppKit's by
`customStoragePrefix`, so the two sessions never overwrite each other.

### Xaman = deep links only

```
https://xaman.app/detect/request:{payin}?amount=…&network=XRPL&dt=…
xumm://xumm.app/detect/request:{payin}?amount=…&network=XRPL&dt=…
```

For XRP deposits the deposit card shows this link as a button plus a QR of the
same URL. No Platform API, no payload, no server credentials.

## Deposit execution

After `create` returns a deposit address, the deposit is funded by whichever
stack owns the source network:

- **EVM** — native value transfer, or ERC-20 `transfer` when the asset has a `tokenContract`
- **Solana** — `SystemProgram.transfer`, or a checked SPL transfer (creating the recipient ATA if absent); tag is written as a memo
- **XRPL** — `Payment` signed and submitted by Joey Wallet, `DestinationTag` included
- **XRP without a connected wallet** — Xaman deep link

## API (same-origin)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/bridge/currencies` | Market list |
| GET | `/v1/bridge/estimate` | Quote |
| GET | `/v1/bridge/min-amount` | Minimum |
| POST | `/v1/bridge/create` | Create order + deposit address |
| GET | `/v1/bridge/status` | Poll order |
| GET | `/v1/bridge/validate-address` | Address check |
| GET | `/api/config` | Public fee flags |

## Fee model

User enters gross `G`. Fee = `G × bps/10000`. Create + estimate use net `G − fee`.

## Build

```bash
npm run build
npm run preview
```

## Vercel

Production API lives under `api/` (bridge proxy only). Set env vars in the
Vercel project:

- `XRPL_TO_API_KEY`
- `VITE_REOWN_PROJECT_ID`
- `PLATFORM_FEE_BPS` (optional, default `85`)

Add the production domain to the Reown project's allowlist, or wallets will
refuse the session.

```bash
vercel --prod
```

Rewrites: `/v1/bridge/*` → `/api/bridge/*`, SPA fallback to `index.html`.
