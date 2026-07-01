# Sample Blueprint — ApkayA Demo

Wire this flow in a **Level Blueprint** or **Actor Blueprint** to mirror the Unity
`ApkayaDemoController` sample.

## Prerequisites

- Engine running on `http://localhost:3005` with a customer API key
- Insight running on `http://localhost:3006`
- A registered contract ID and backend wallet ID (from Dashboard or CLI)

## Variables

| Name | Type | Example |
|---|---|---|
| `ApkayaConfig` | `FApkayaClientConfig` | Engine URL, API key, Insight URL |
| `ConnectedAddress` | String | Set after SIWE verify |
| `SessionToken` | String | From SIWE verify |
| `ChainId` | Integer | `80002` |
| `ContractId` | String | From Dashboard |
| `BackendWalletId` | String | From Dashboard |

## 1. Connect wallet (SIWE)

After your WalletConnect integration returns `WalletAddress`:

1. **Apkaya Request Siwe Nonce**
   - Config: `ApkayaConfig`
   - Address: `WalletAddress`
   - Chain Id: `80002`
   - Domain: `mygame.com`
   - Uri: `mygame://auth`
2. Show `NonceResult.Message` to the player (WC wallet signs it).
3. **Apkaya Verify Siwe** with message + signature from WC.
4. Store `Session.Address` and `Session.SessionToken`.

## 2. Show token balances (Insight)

**Apkaya Get Token Balances**

- Config: `ApkayaConfig`
- Wallet Address: `ConnectedAddress`
- Chain Id: `80002`

Bind the delegate output to update UI text with each `ContractAddress` / `Balance`.

## 3. Contract write + status

**Apkaya Write Contract**

- Contract Id: `ContractId`
- From Wallet Id: `BackendWalletId`
- Function Name: `mintTo`
- Args Json Array: `["0xYourPlayerAddress", "1000000000000000000"]`

On success, note `Transaction.Id`, then loop **Apkaya Get Transaction Status** every
2 seconds until `Status` is `mined`, `reverted`, `errored`, or `cancelled`.

## WalletConnect QR

When your WC layer produces a pairing URI, call **Apkaya Format Wallet Connect Pairing Hint**
and render the URI as a QR texture in your UI widget.
