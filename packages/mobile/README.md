# @apkaya/mobile-sdk

React Native SDK for ApkayA — thin mobile layer over `@apkaya/sdk` and
`@apkaya/connect`. Same REST contracts, auth (SIWE), and response shapes as
the web SDK; only transport, secure storage, and UI are platform-specific.

## Why Expo (development build)

This package targets **Expo with a development build** (not Expo Go alone).

| Requirement | Expo Go | Expo dev build |
|---|---|---|
| `react-native-keychain` (Keychain / Keystore) | Limited | Supported |
| `@walletconnect/react-native-compat` | Requires native polyfills | Supported |
| Deep links for WalletConnect return | Configurable | Supported |

Expo was chosen over bare RN because the example app and native-module wiring
are simpler while still meeting the keychain + WalletConnect requirements via
`expo prebuild` / EAS Build.

## Install

```bash
npm install @apkaya/mobile-sdk @apkaya/sdk @apkaya/connect \
  react-native-keychain @walletconnect/react-native-compat \
  @walletconnect/universal-provider react-native-get-random-values
```

In your app entry (before any SDK code):

```typescript
import "@walletconnect/react-native-compat";
import "react-native-get-random-values";
```

## Quick start

```tsx
import { MobileConnectProvider, useMobileConnect } from "@apkaya/mobile-sdk";

<MobileConnectProvider
  engineBaseUrl="http://localhost:3005"
  engineApiKey="dev-secret-key-change-me"
  insightBaseUrl="http://localhost:3006"
  chainId={80002}
  walletConnectProjectId="YOUR_WC_PROJECT_ID"
  walletConnectMobile={{ appLinkScheme: "apkayaexample" }}
  siwe={{ domain: "myapp.com", uri: "apkayaexample://auth" }}
>
  <App />
</MobileConnectProvider>
```

```tsx
const { client, connectWalletConnect, address, client.insight } = useMobileConnect();

await connectWalletConnect();
const balances = await client.insight.tokenBalances(address!, 80002);
```

## Secure storage

`createKeychainStorage()` implements `@apkaya/connect`'s `SecureStorage` using
**react-native-keychain** (iOS Keychain / Android Keystore). In-app email
sessions and SIWE JWTs are persisted through the same interface as web
`localStorage`, without forking connect logic.

## WalletConnect + deep links

`WalletConnectMobileAdapter` uses WalletConnect v2 `UniversalProvider` and
opens `wc:` URIs via React Native `Linking`. Register your app scheme in
`app.json`:

```json
{
  "expo": {
    "scheme": "apkayaexample"
  }
}
```

Handle return URLs in your root component:

```tsx
import { Linking } from "react-native";
import { handleWalletConnectDeepLink } from "@apkaya/mobile-sdk";

useEffect(() => {
  const sub = Linking.addEventListener("url", ({ url }) => {
    handleWalletConnectDeepLink(url);
  });
  return () => sub.remove();
}, []);
```

## Example app

See `apps/mobile-example-rn` — connect wallet, Insight balances, Engine tx.

## Parity with Flutter

See [MOBILE_PARITY.md](../../MOBILE_PARITY.md) for feature-by-feature comparison.
