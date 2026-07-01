# Mobile SDK parity — React Native vs Flutter

Both mobile SDKs expose equivalent capability over the same Engine + Insight
REST contracts. Implementation languages differ; feature parity does not.

| Capability | `@apkaya/mobile-sdk` (RN) | `apkaya_flutter_sdk` (Flutter) | Notes |
|---|---|---|---|
| **Engine client** | Re-exports `ApkayaClient` from `@apkaya/sdk` | `ApkayaClient` Dart port | 1:1 resource names |
| `wallets.create/list/get/balance` | via `client.wallets.*` | `client.wallets.*` | Same JSON shapes |
| `transactions.send/status/list/cancel/waitForMined` | via `client.transactions.*` | `client.transactions.*` | |
| `chains.list` | via `client.chains.*` | `client.chains.*` | |
| `contracts.register/list/get/read/write` | via `client.contracts.*` | `client.contracts.*` | |
| `apiKeys.*` | via `client.apiKeys.*` | `client.apiKeys.*` | Admin key required |
| `auth.siweNonce/verify` | via `@apkaya/connect` + provider | `client.auth` + `ApkayaConnect` | Same `/auth/siwe/*` |
| `auth.email OTP` | `connectInAppEmail` / `verifyInAppEmail` | `ApkayaConnect.requestEmailCode/verifyEmailCode` | Same endpoints |
| `auth.inApp sign/send` | `InAppWalletAdapter` | `ApkayaConnect.signMessage/sendInAppTransaction` | `X-Apkaya-Session` header |
| `bridge.*` | via `client.bridge.*` | `client.bridge.*` | Server-only CDP proxy |
| **Insight client** | `client.insight.*` | `client.insight.*` | Separate base URL |
| `insight.status` | yes | yes | |
| `insight.tokenBalances` | yes | yes | |
| `insight.nftsOwned` | yes | yes | |
| `insight.transfers/events` | yes | yes | |
| **Secure session storage** | `createKeychainStorage()` | `SecureSessionStorage` | Keychain / Keystore |
| **WalletConnect v2** | `WalletConnectMobileAdapter` | `ApkayaWalletConnect` + Reown AppKit | RN: UniversalProvider + Linking; Flutter: reown_appkit |
| **SIWE after WC connect** | `MobileConnectProvider` auto | `prepareSiwe` + `completeSiwe` | Same Engine JWT |
| **Email in-app wallet** | `InAppWalletAdapter` + keychain | `ApkayaConnect` + secure storage | Same custody model |
| **Deep link handling** | `Linking` + `handleWalletConnectDeepLink` | `app_links` + AppKit | Platform config in READMEs |
| **Example app** | `apps/mobile-example-rn` | `apps/mobile-example-flutter` | Connect / balance / send tx |

## Gaps

| Gap | RN | Flutter | Plan |
|---|---|---|---|
| Pre-built connect modal UI | Minimal provider hooks only | `ApkayaConnect` service only | Apps compose native UI; parity is API-level |
| Injected browser wallet | N/A (mobile) | N/A | By design |
| Reown AppKit widget wired in SDK | N/A (uses UniversalProvider directly) | Documented; app integrates AppKit | Flutter WC UI left to app shell (same as RN showing URI) |

No Flutter capability is intentionally omitted relative to React Native for
Engine, Insight, auth, or storage. Bridge widgets are server-backed on both;
neither mobile SDK ships Buy/Swap UI (same as web SDK — widgets live in
`@apkaya/bridge` for React web).
