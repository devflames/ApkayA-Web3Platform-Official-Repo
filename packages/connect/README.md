# @apkaya/connect

End-user wallet connection for ApkayA apps — popup modal, multiple wallet types,
headless hooks, and SIWE/email auth backed by Engine.

This package is **distinct from Engine backend wallets**. Backend wallets are
for your server to sign on behalf of your app. Connect is for a human end user
to link their own wallet (browser extension, WalletConnect, or email in-app wallet).

## Install

```bash
npm install @apkaya/connect
```

Peer dependency: `react` ^18 (UI components only — core adapters work without React).

## Quick start (React)

```tsx
import { ConnectProvider, ConnectButton } from "@apkaya/connect/react";
import "@apkaya/connect/styles.css";

<ConnectProvider
  config={{
    chainId: 80002,
    engine: { baseUrl: "http://localhost:3005", apiKey: "your-app-key" },
    walletConnectProjectId: "optional-wc-project-id",
    siwe: {
      domain: window.location.host,
      uri: window.location.origin,
    },
  }}
>
  <ConnectButton />
</ConnectProvider>
```

Also available: `<ConnectEmbed />` (inline, non-modal) and headless hooks
(`useConnect`, `useAddress`, `useBalance`, …).

## WalletAdapter interface

Every wallet type implements the same interface so UI and hooks never branch on wallet type:

```typescript
interface WalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly type: "injected" | "walletconnect" | "in-app";
  isAvailable(): boolean | Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;
  signMessage(message: string): Promise<string>;
  sendTransaction(tx: SendTransactionRequest): Promise<string>;
  subscribeAccountChange(callback: (address: string | null) => void): () => void;
}
```

### Built-in adapters

| Adapter | File | Description |
|---|---|---|
| `InjectedAdapter` | `adapters/injected.ts` | `window.ethereum` / EIP-1193 (MetaMask, Rabby, …) |
| `WalletConnectAdapter` | `adapters/walletConnect.ts` | WalletConnect v2 with QR modal |
| `InAppWalletAdapter` | `adapters/inApp.ts` | Email OTP → Engine custody wallet |

### Adding a new wallet type

1. Create `src/adapters/myWallet.ts` implementing `WalletAdapter`.
2. Export it from `src/adapters/index.ts`.
3. Register it in `ConnectProvider`'s `availableAdapters` list (or pass a custom adapter array if you fork the provider).

Social login (Google, Apple, X) is stubbed via `SocialAuthProvider` in
`core/types.ts` — not implemented in v0.

## In-app wallet custody model (read this)

**We do not store raw private keys in the browser.**

Email in-app wallets use **server-side custody** behind Engine's existing
AES-256-GCM wallet encryption (`WALLET_ENCRYPTION_KEY`). Each verified email
creates (or restores) an `end_users` row linked to a dedicated
`backend_wallets` row with `key_type = 'in_app'`.

The end user authenticates via email OTP → Engine issues a **session JWT**
(`SESSION_JWT_SECRET`). Signing and sending for in-app wallets go through
Engine endpoints (`/auth/in-app/sign-message`, `/auth/in-app/send-transaction`)
using the `X-Apkaya-Session` header — the private key never leaves the server.

### Tradeoffs (explicit)

| Approach | Pros | Cons |
|---|---|---|
| **Engine custody (chosen for v0)** | No extension required; reuses proven encryption; auditable single code path | Users trust your Engine instance; not self-custody |
| Client-side MPC/sharding | Stronger user sovereignty | Complex, easy to get wrong; not shipped in v0 |
| Plaintext localStorage keys | Simple | **Never acceptable** — we do not do this |

If you self-host Engine, you control custody. Document this to your users.
For production email OTP, configure a real mail provider (v0 logs OTPs when
`ENGINE_AUTH_DEV_LOG_OTP=true`).

Injected and WalletConnect wallets remain **self-custody** — keys stay in the
user's wallet. Optional SIWE verification binds the address to an Engine session.

## Theming

`ConnectTheme` in `core/theme.ts` defines CSS variables shared with future Bridge
widgets (`BuyWidget`, etc. in Phase 4B). Defaults match `apps/dashboard`:

```tsx
<ConnectButton theme={{ accent: "#ff5a1f", radius: "2px" }} />
```

## SIWE (EIP-4361)

When `config.siwe` is set, injected/WalletConnect connections automatically
request a SIWE nonce from Engine, prompt the user to sign, and verify server-side.

Core helpers (framework-agnostic): `requestSiweNonce`, `verifySiwe` in `core/siwe.ts`.

## Engine endpoints

See `apps/engine/README.md` → **End-user auth (Connect / SIWE)**.

## Exports

- `@apkaya/connect` — adapters, types, theme, SIWE helpers
- `@apkaya/connect/react` — `ConnectProvider`, `ConnectButton`, `ConnectEmbed`, hooks
- `@apkaya/connect/styles.css` — base component styles
