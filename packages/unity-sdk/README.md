# ApkayA Unity SDK

Thin Unity client for **ApkayA Engine** and **Insight** REST APIs. Same contracts
and JSON shapes as `packages/sdk` — no duplicated business logic. Wallet connect
uses **WalletConnect v2** (QR / deep link via your WC integration) plus **SIWE**
session issuance through Engine's `/auth/siwe/*` endpoints.

**Minimum Unity version:** 2021.3 LTS (2021.3.0f1+)

## How it works

```
 Game (Unity) ──UnityWebRequest──▶ Engine API ──▶ queue / sign / broadcast
        │                              │
        └── Insight API ◀── indexed ERC20 / NFT events
        │
        └── WalletConnect v2 (QR) ──▶ player wallet signs SIWE message
                                      └── POST /auth/siwe/verify → session JWT
```

The SDK is a **transport + wallet UX layer only**. Transaction signing for
backend wallets, gas estimation, and indexing all happen in Engine/Insight.

## Install

### Local (monorepo)

1. Open Unity **2021.3+**
2. **Window → Package Manager → + → Add package from disk…**
3. Select `packages/unity-sdk/package.json`

### Git URL (when published)

```
https://github.com/devflames/ApkayA-Web3Platform.git?path=packages/unity-sdk
```

Dependencies: `com.unity.nuget.newtonsoft-json` (declared in `package.json`).

## Quick start

```csharp
using Apkaya.UnitySdk;
using Apkaya.UnitySdk.Connect;

var client = new ApkayaClient(new ApkayaConfig {
    EngineBaseUrl = "http://localhost:3005",
    InsightBaseUrl = "http://localhost:3006",
    ApiKey = "dev-secret-key-change-me"
});

var connect = new ApkayaConnect(client, chainId: 80002, "mygame.com", "mygame://auth");
var session = await connect.ConnectWithExternalWalletAsync(myWalletConnectAdapter);

var balances = await client.GetTokenBalancesAsync(session.address, 80002);
var tx = await client.WriteContractAsync(contractId, walletId, "mintTo",
    new object[] { session.address, "1000000000000000000" });
var mined = await client.WaitForMinedAsync(tx.id);
```

## API Reference

All requests send `Authorization: Bearer {apiKey}`. Responses unwrap `{ "result": … }`.

### Wallets

| Method | Engine path | Description |
|---|---|---|
| `CreateWalletAsync(label)` | POST `/backend-wallet/create` | Create managed backend wallet |
| `ListWalletsAsync()` | GET `/backend-wallet` | List wallets |
| `GetWalletAsync(id)` | GET `/backend-wallet/:id` | Get one wallet |

### Transactions

| Method | Engine path | Description |
|---|---|---|
| `SendTransactionAsync(...)` | POST `/transaction/send` | Queue transaction |
| `GetTransactionStatusAsync(id)` | GET `/transaction/status/:id` | Poll status |
| `WaitForMinedAsync(id)` | (polls status) | Wait until terminal state |

### Contracts

| Method | Engine path | Description |
|---|---|---|
| `GetContractAsync(id)` | GET `/contract/:id` | Contract + ABI |
| `ReadContractAsync(id, fn, args)` | POST `/contract/:id/read` | View call |
| `WriteContractAsync(id, wallet, fn, args)` | POST `/contract/:id/write` | Queued write |

### Chains

| Method | Engine path |
|---|---|
| `ListChainsAsync()` | GET `/chain` |

### Insight

| Method | Insight path | Description |
|---|---|---|
| `GetTokenBalancesAsync(address, chainId)` | GET `/insight/tokens/:address/balances` | Indexed ERC20 balances |

### Auth (Connect / SIWE)

| Method | Engine path | Description |
|---|---|---|
| `SiweNonceAsync(...)` | POST `/auth/siwe/nonce` | EIP-4361 message |
| `SiweVerifyAsync(message, sig)` | POST `/auth/siwe/verify` | Session JWT |
| `EmailRequestCodeAsync(email)` | POST `/auth/email/request-code` | OTP |
| `EmailVerifyCodeAsync(email, code)` | POST `/auth/email/verify-code` | In-app wallet session |

## WalletConnect v2

Implement `IApkayaExternalWallet` using [WalletConnect Unity](https://docs.walletconnect.com/) or
WalletConnectSharp:

1. Initialize WC with your Reown project ID
2. Display `ApkayaWalletConnectSession.PairingUri` as QR (use a QR texture plugin)
3. On connect, return address from `ConnectAsync()`
4. Route `SignMessageAsync` to the WC session for SIWE

Deep links: register `mygame://` in **Player Settings → iOS/Android URI schemes**.

## Sample

Import **Samples → ApkayA Demo** from Package Manager. See
`Samples~/ApkayaDemo/README.md` for scene wiring.

## Production checklist

- [ ] Never ship `ENGINE_ADMIN_KEY` in the game client — use customer API keys only
- [ ] Use HTTPS for Engine/Insight in production builds
- [ ] Replace demo `IApkayaExternalWallet` mock with real WalletConnect v2
- [ ] Store session JWT securely (`PlayerPrefs` is not sufficient for high-value apps)

## Parity

See [GAME_ENGINE_PARITY.md](../../GAME_ENGINE_PARITY.md) for Unity vs Unreal coverage.
