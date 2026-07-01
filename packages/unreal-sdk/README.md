# ApkayA Unreal SDK

Thin Unreal Engine plugin for **ApkayA Engine** and **Insight** REST APIs. Same contracts
and JSON shapes as `packages/sdk` — no duplicated business logic. Wallet connect uses
**WalletConnect v2** (QR / deep link via your WC integration) plus **SIWE** session
issuance through Engine's `/auth/siwe/*` endpoints.

**Minimum Unreal Engine version:** 5.1 (5.1.0+). Compatible with UE 5.2–5.4.

## How it works

```
 Game (Unreal) ──FHttpModule──▶ Engine API ──▶ queue / sign / broadcast
        │                              │
        └── Insight API ◀── indexed ERC20 / NFT events
        │
        └── WalletConnect v2 (QR) ──▶ player wallet signs SIWE message
                                      └── POST /auth/siwe/verify → session JWT
```

The plugin is a **transport + wallet UX layer only**. Transaction signing for
backend wallets, gas estimation, and indexing all happen in Engine/Insight.

## Install

### Local (monorepo)

1. Copy or symlink `packages/unreal-sdk` into your project's `Plugins/` folder:
   ```
   YourProject/Plugins/ApkayaUnreal/
   ```
2. Open the project in Unreal **5.1+**
3. **Edit → Plugins → ApkayA Unreal SDK** → Enable → Restart

Alternatively, add to your `.uproject`:

```json
{
  "Plugins": [
    { "Name": "ApkayaUnreal", "Enabled": true }
  ]
}
```

## Quick start (Blueprint)

1. Create a **Make Apkaya Config** node with Engine URL, API key, and Insight URL.
2. **Apkaya Request Siwe Nonce** → display message in UI → player signs in WC wallet.
3. **Apkaya Verify Siwe** → store returned session token.
4. **Apkaya Get Token Balances** with connected address + chain ID.
5. **Apkaya Write Contract** with `contractId`, backend `fromWalletId`, function name,
   and args as a JSON array string (e.g. `["0xabc...", "1000000000000000000"]`).
6. Poll with **Apkaya Get Transaction Status** until status is `mined` or terminal.

### C++

```cpp
#include "ApkayaClient.h"

FApkayaClientConfig Config;
Config.EngineBaseUrl = TEXT("http://localhost:3005");
Config.InsightBaseUrl = TEXT("http://localhost:3006");
Config.ApiKey = TEXT("dev-secret-key-change-me");

FApkayaClient Client(Config);
    Client.GetTokenBalances(
    TEXT("0x..."),
    80002,
    FApkayaTokenBalancesDelegate::CreateUObject(/* YourObject */, /* FunctionName */));
```

## API Reference

All requests send `Authorization: Bearer {apiKey}`. Responses unwrap `{ "result": … }`.

### Blueprint nodes (`UApkayaBlueprintLibrary`)

| Node | Engine / Insight path | Description |
|---|---|---|
| `ApkayaSendTransaction` | POST `/transaction/send` | Queue transaction |
| `ApkayaGetTransactionStatus` | GET `/transaction/status/:id` | Poll status |
| `ApkayaWriteContract` | POST `/contract/:id/write` | Queued contract write |
| `ApkayaGetTokenBalances` | GET `/insight/tokens/:address/balances` | Indexed ERC20 balances |
| `ApkayaRequestSiweNonce` | POST `/auth/siwe/nonce` | EIP-4361 message |
| `ApkayaVerifySiwe` | POST `/auth/siwe/verify` | Session JWT |

C++ `FApkayaClient` also exposes `RequestEmailCode` / `VerifyEmailCode` for in-app
email custody wallets (same as Unity `ApkayaConnect`).

### Wallets (C++ only — extend via your game code)

Use direct HTTP against `/backend-wallet/*` or add Blueprint wrappers as needed.
The TypeScript SDK's `wallets.*` surface is available on Engine; this plugin
focuses on transactions, contracts, Insight, and auth.

## WalletConnect v2

The plugin does **not** embed WalletConnect. Integrate [Reown WalletConnect](https://docs.reown.com/)
or a community UE plugin:

1. Initialize WC with your Reown project ID
2. Display the pairing URI (use `ApkayaFormatWalletConnectPairingHint`) as QR
3. On connect, pass the wallet address to `ApkayaRequestSiweNonce`
4. Route the SIWE signature to `ApkayaVerifySiwe`

Register custom URL schemes in **Project Settings → Platforms → Android/iOS** for deep links.

## Sample Blueprint flow

See `Content/Samples/README.md` for a step-by-step Level Blueprint wiring guide:
connect wallet (SIWE), show Insight balances, contract write + status poll.

## Production checklist

- [ ] Never ship `ENGINE_ADMIN_KEY` in the game client — use customer API keys only
- [ ] Use HTTPS for Engine/Insight in production builds
- [ ] Wire real WalletConnect v2 instead of test signatures
- [ ] Store session JWT in platform secure storage, not save-game plaintext

## Parity

See [GAME_ENGINE_PARITY.md](../../GAME_ENGINE_PARITY.md) for Unity vs Unreal coverage.
