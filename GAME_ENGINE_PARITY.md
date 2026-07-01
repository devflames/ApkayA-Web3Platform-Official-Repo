# Game engine SDK parity — Unity vs Unreal

Both game-engine SDKs expose equivalent capability over the same Engine + Insight
REST contracts. Implementation languages differ; feature parity does not.

| Capability | `packages/unity-sdk` (Unity C#) | `packages/unreal-sdk` (Unreal C++) | Notes |
|---|---|---|---|
| **Engine client** | `ApkayaClient` | `FApkayaClient` + Blueprint library | 1:1 resource paths |
| `wallets.create/list/get` | `CreateWalletAsync`, etc. | C++ only (extend as needed) | Same JSON shapes |
| `transactions.send/status/waitForMined` | yes | send + status (poll in BP/C++) | |
| `chains.list` | `ListChainsAsync` | not wrapped (direct HTTP) | Add BP node if needed |
| `contracts.get/read/write` | yes | write + status; read via HTTP | |
| `auth.siweNonce/verify` | `SiweNonceAsync` / `SiweVerifyAsync` | Blueprint + C++ | Same `/auth/siwe/*` |
| `auth.email OTP` | `ApkayaConnect` email helpers | C++ `RequestEmailCode` / `VerifyEmailCode` | Same endpoints |
| **Insight client** | `GetTokenBalancesAsync` | `ApkayaGetTokenBalances` | Separate base URL |
| `insight.tokenBalances` | yes | yes | |
| **WalletConnect v2** | `IApkayaExternalWallet` + `ApkayaWalletConnectSession` | Pairing URI hint + app WC integration | Neither embeds WC SDK |
| **SIWE after WC connect** | `ApkayaConnect.ConnectWithExternalWalletAsync` | Nonce → sign → verify in Blueprint | Same Engine JWT |
| **Sample** | `Samples~/ApkayaDemo` C# controller | `Content/Samples/README.md` Blueprint guide | |

## Gaps

| Gap | Unity | Unreal | Plan |
|---|---|---|---|
| Embedded WalletConnect SDK | No — interface + docs | No — docs + URI helper | Games integrate Reown / community plugin |
| Pre-built connect UI | Sample mock wallet | Blueprint wiring guide | API-level parity only |
| `WaitForMined` helper | `WaitForMinedAsync` | Poll status in game loop | Trivial to add in game code |
| Full SDK surface in Blueprint | All main paths in C# | Transactions, contracts, Insight, SIWE | Wallets/chains/read via C++ or future nodes |

Neither SDK duplicates Engine business logic. Bridge Buy/Swap widgets remain web-only
(`@apkaya/bridge`); game clients call Engine/Insight only.

## Minimum engine versions

| SDK | Minimum version |
|---|---|
| Unity | 2021.3 LTS |
| Unreal | 5.1 |
