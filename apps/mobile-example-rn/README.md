# ApkayA Mobile Example (React Native / Expo)

Demonstrates `@apkaya/mobile-sdk`:

1. Connect wallet (WalletConnect or email in-app)
2. Read Insight token balances
3. Send a queued Engine transaction

```bash
cd apps/mobile-example-rn
npm install
EXPO_PUBLIC_ENGINE_URL=http://localhost:3005 \
EXPO_PUBLIC_INSIGHT_URL=http://localhost:3006 \
EXPO_PUBLIC_API_KEY=dev-secret-key-change-me \
EXPO_PUBLIC_WC_PROJECT_ID=your_reown_project_id \
npm start
```

Use a **development build** (`npx expo prebuild` + run on device/simulator) for
keychain and WalletConnect native modules.
