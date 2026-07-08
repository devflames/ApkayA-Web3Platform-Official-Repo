# @apkaya/bridge

Embeddable buy, swap, and checkout widgets powered by **Coinbase Developer Platform (CDP)**.
All CDP secrets stay on Engine — the browser never sees your CDP API key.

## CDP API key (read this first)

You need a **CDP Secret API Key** from [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com):

1. Create a project → **API Keys** → **Secret API Keys**
2. Download the JSON — it contains **Key ID** and **Private Key (Secret)**
3. Set on Engine (never in the browser):

```env
CDP_API_KEY_ID=organizations/.../apiKeys/...
# Paste the **private key** value from the downloaded CDP JSON.
# Keep it as a single line in your `.env` (use \n if your key contains newlines).
# Example (placeholder):
CDP_API_KEY_SECRET="-----BEGIN EC PRIVATE KEY-----\\nREDACTED\\n-----END EC PRIVATE KEY-----\\n"
```

**Do not** use a Coinbase Exchange / Advanced Trade API key — different product, different auth, not usable here.

## CDP products wired in this package

| Product | Engine route | Widget usage |
|---|---|---|
| **Onramp** (fiat → crypto) | `POST /bridge/onramp/session` | BuyWidget → Card → Coinbase popup |
| **Trade / Swap** (crypto ↔ crypto) | `POST /bridge/swap/quote`, `POST /bridge/swap/execute` | BuyWidget → Crypto, SwapWidget |
| **Offramp** | Not implemented in v0 | Future phase |

Session tokens from onramp are **single-use, 5-minute TTL** — never cache or reuse them.

## Chain coverage (as of implementation, July 2025)

**CDP Trade/Swap API (beta)** supports these mainnets only:

- Ethereum (`chainId` 1)
- Base (`8453`)
- Arbitrum (`42161`)
- Optimism (`10`)
- Polygon (`137`)

Engine must have `CHAIN_<id>_RPC_URL` configured for a chain to appear in widget selectors.
Testnets (e.g. Polygon Amoy `80002`) are **not** covered by CDP swap — onramp may work in trial/sandbox with mapped blockchains.

Verify current coverage: [CDP Trade API welcome](https://docs.cdp.coinbase.com/trade-api/welcome)

## Install

```bash
npm install @apkaya/bridge @apkaya/connect
```

## Quick start

```tsx
import { ConnectProvider } from "@apkaya/connect/react";
import { BridgeProvider, BuyWidget, SwapWidget } from "@apkaya/bridge/react";
import "@apkaya/connect/styles.css";
import "@apkaya/bridge/styles.css";

<ConnectProvider config={{ chainId: 8453, engine: { baseUrl, apiKey } }}>
  <BridgeProvider engine={{ baseUrl, apiKey }}>
    <BuyWidget />
    <SwapWidget />
  </BridgeProvider>
</ConnectProvider>
```

## Theming

Uses the same `ConnectTheme` prop shape as `@apkaya/connect` — configure colors once for Connect and Bridge:

```tsx
<BuyWidget theme={{ accent: "#ff5a1f", radius: "2px" }} />
```

## Provider interfaces

Swap and onramp are behind interfaces so a second provider can be added later:

- `OnrampProvider` / `CoinbaseOnrampProvider`
- `SwapProvider` / `CoinbaseSwapProvider`

Both call Engine routes only — never CDP directly from the browser.

## Components

| Component | Description |
|---|---|
| `BuyWidget` | Chain + token selectors, card onramp or crypto swap |
| `SwapWidget` | Swap-only variant |
| `CheckoutWidget` | Fixed-amount checkout |
| `TransactionButton` / `TransactionWidget` | Submit prepared tx, poll status |

## Onramp popup events

BuyWidget listens for CDP postMessage events (`onramp_api.polling_success`, `onramp_api.cancel`, etc.) from `pay.coinbase.com` and updates UI state when the popup closes.

## Engine routes

See `apps/engine/README.md` → **Bridge (CDP)**.
