# ApkayA Demo Sample

Import via Package Manager → **ApkayA Unity SDK** → Samples → **ApkayA Demo**.

## Scene setup

1. Create a Canvas with three Buttons and a status `Text`.
2. Add an empty GameObject with `ApkayaDemoController`.
3. Wire button `OnClick` to:
   - `OnConnectWalletClicked`
   - `OnShowInsightBalancesClicked`
   - `OnContractWriteClicked`
4. Set `engineBaseUrl`, `apiKey`, `contractId`, `backendWalletId` in the Inspector.

Replace `IApkayaExternalWallet` mock implementation with WalletConnect Unity Modal
for production QR/deep-link wallet connect.
