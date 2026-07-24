# Riddle Bridge

Cross-chain bridge app for the Riddle ecosystem.

- **0.85%** platform fee on every bridge
- **Xaman deep links** for XRPL deposits (`detect/request:…`) — QR is the same URL, not a second system
- Full bridge surface: currencies · estimate · min-amount · create · status · validate-address
- Upstream execution is server-proxied (API key never exposed; partner branding not shown)

## Quick start

```bash
cd riddle-bridge
npm install
npm run dev
```

Open http://localhost:5177

### Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `XRPL_TO_API_KEY` | yes | Bridge execution API key (server only) |
| `PLATFORM_FEE_BPS` | optional | Fee in basis points (default `85` = 0.85%) |

## Xaman = deep links only

```
https://xaman.app/detect/request:{payin}?amount=…&network=XRPL&dt=…
xumm://xumm.app/detect/request:{payin}?amount=…&network=XRPL&dt=…
```

On **Bridge** (XRPL source): open deep link immediately (user gesture). Deposit card shows the same link as primary button + QR of that URL. No Platform API, no SignIn payload, no second signing system.

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

Production API lives under `api/` (bridge proxy + Xaman Sign-In). Set env vars in the Vercel project:

- `XRPL_TO_API_KEY`
- `XUMM_API_KEY`
- `XUMM_API_SECRET`
- `PLATFORM_FEE_BPS` (optional, default `85`)

```bash
vercel --prod
```

Rewrites: `/v1/bridge/*` → `/api/bridge/*`, SPA fallback to `index.html`.
