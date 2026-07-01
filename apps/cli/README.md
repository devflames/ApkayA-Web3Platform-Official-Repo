# CLI

The `apkaya` command line tool — scaffold projects, deploy contracts, and
manage Engine wallets/transactions without leaving your terminal.

## Install (from this monorepo, for local development)

```bash
cd apps/cli
npm install
npm run build
npm link          # makes `apkaya` available globally
```

## Commands

### `apkaya login`
Prompts for your Engine base URL and API key, tests the connection, and
saves them to `~/.apkaya/config.json`. Every other command that talks to
Engine reads from here (or from `ENGINE_URL` / `ENGINE_API_KEY` env vars,
which take priority — handy for CI).

### `apkaya create [name]`
Scaffolds a new project. Choose between:
- **Contract project** — Solidity + Hardhat, starts with a `MyToken.sol` ERC20.
- **Frontend app** — React + Vite, pre-wired to `@apkaya/sdk`.

### `apkaya deploy`
Run from inside a contract project after `npm run compile`. Finds your
compiled Hardhat artifacts, lets you pick one, prompts for constructor
arguments and an RPC URL + private key, and deploys it directly (this uses
your own key locally — it does not go through Engine, since Engine wallets
are meant for *ongoing* app transactions, not one-off deploys).

### `apkaya wallet create <label>` / `list` / `balance <id> <chainId>`
Manage backend wallets on your Engine instance.

### `apkaya tx send --chain-id <id> --from <walletId> --to <address> [--data 0x..] [--value <wei>]`
Queue a transaction through Engine. Also: `apkaya tx status <id>` and
`apkaya tx list [--status queued]`.

### `apkaya apikey create <label>` / `list` / `revoke <id>` / `reactivate <id>`
Issue and manage customer-facing API keys. **These require you to be
logged in with Engine's admin key** (`ENGINE_ADMIN_KEY`), not a regular
customer key — key management is intentionally separated so a leaked
customer key can never be used to mint or revoke other keys. The raw key
is printed once on creation; Engine only stores its hash, so if you lose
it you must revoke and issue a new one.

## Example: end-to-end

```bash
apkaya login
apkaya create my-token-project
cd my-token-project
npm install
npm run compile
apkaya deploy                              # deploy MyToken.sol, note the address
apkaya wallet create checkout-wallet         # create an Engine-managed wallet
apkaya tx send --chain-id 80002 \
  --from <walletId> --to <deployedAddress> \
  --data <0x-encoded-mintTo-calldata>
apkaya tx status <txId>
```
