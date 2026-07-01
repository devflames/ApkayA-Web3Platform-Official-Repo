# ApkayA Mobile Example (Flutter)

Same three flows as `apps/mobile-example-rn`:

1. Connect wallet (email in-app — WalletConnect via Reown AppKit in your production app)
2. Read Insight token balances
3. Send a queued Engine transaction

```bash
cd apps/mobile-example-flutter
flutter pub get
flutter run --dart-define=ENGINE_URL=http://localhost:3005 \
  --dart-define=INSIGHT_URL=http://localhost:3006 \
  --dart-define=API_KEY=dev-secret-key-change-me
```

Add deep-link intent filters / URL schemes per `packages/flutter-sdk/README.md`
when wiring WalletConnect.
