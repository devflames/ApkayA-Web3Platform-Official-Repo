# apkaya_flutter_sdk

First-class Dart/Flutter client for ApkayA — mirrors `packages/sdk` method
surface 1:1 (Engine + Insight REST) with mobile wallet connect (WalletConnect
v2 + SIWE + email in-app wallet).

**Minimum:** Dart 3.3+, Flutter 3.19+

## Install

Add to `pubspec.yaml`:

```yaml
dependencies:
  apkaya_flutter_sdk:
    path: ../packages/flutter-sdk   # monorepo
```

Run:

```bash
flutter pub get
```

## HTTP client (mirrors `@apkaya/sdk`)

```dart
final client = ApkayaClient(ApkayaClientOptions(
  baseUrl: 'http://localhost:3005',
  apiKey: 'dev-secret-key-change-me',
  insightBaseUrl: 'http://localhost:3006',
));

final wallet = await client.wallets.create('mobile-wallet');
final tx = await client.transactions.send(
  chainId: 80002,
  fromWalletId: wallet.id,
  toAddress: '0x000000000000000000000000000000000000dEaD',
  valueWei: '1000000000000000',
);
final balances = await client.insight.tokenBalances(wallet.address, 80002);
```

Resource APIs: `wallets`, `transactions`, `chains`, `contracts`, `apiKeys`,
`auth`, `bridge`, `insight` — same names and JSON shapes as TypeScript SDK.

## Secure storage

`SecureSessionStorage` uses **flutter_secure_storage**:

- iOS: Keychain (`WHEN_UNLOCKED`)
- Android: EncryptedSharedPreferences / Keystore

Same security bar as RN `react-native-keychain`.

## Wallet connect + SIWE

```dart
final connect = ApkayaConnect(
  client: client,
  chainId: 80002,
  siweDomain: 'myapp.com',
  siweUri: 'apkayaexample://auth',
);
await connect.initialize();

// Email in-app wallet
final devCode = await connect.requestEmailCode('user@example.com');
await connect.verifyEmailCode('user@example.com', devCode ?? '123456');

// External wallet: use Reown AppKit in UI, then:
final nonce = await connect.prepareSiwe(walletAddress);
// ... wallet signs nonce.message ...
await connect.completeSiwe(
  walletAddress: walletAddress,
  message: nonce.message,
  signature: signature,
);
```

### WalletConnect v2 (Reown AppKit)

This SDK documents integration with **reown_appkit** (maintained WalletConnect
v2 stack for Flutter). Wire AppKit in your `MaterialApp` and pass connected
addresses into `ApkayaConnect.prepareSiwe` / `completeSiwe`.

## Platform setup

### iOS — `ios/Runner/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>apkayaexample</string>
    </array>
  </dict>
</array>
```

### Android — `android/app/src/main/AndroidManifest.xml`

Inside `<activity android:name=".MainActivity">`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="apkayaexample"/>
</intent-filter>
```

For `flutter_secure_storage` on Android, use `minSdkVersion 23+`.

## Example app

See `apps/mobile-example-flutter` — same three flows as the RN example.

## Parity with React Native

See [MOBILE_PARITY.md](../../MOBILE_PARITY.md).
