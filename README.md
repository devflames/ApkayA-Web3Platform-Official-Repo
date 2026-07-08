# ApkayA Web3Platform

An open, self-hostable developer infrastructure platform for building on-chain
apps — contracts, wallets, and a transaction backend

**Official public repository:** [github.com/devflames/ApkayA-Web3Platform-Official-Repo](https://github.com/devflames/ApkayA-Web3Platform-Official-Repo)

## Monorepo layout

```
apps/
  engine/      Transaction backend: queues, signs, and sends blockchain
               transactions. Manages backend wallets. Exposes a REST API.
               This is the core, independently-deployable service.
  insight/     Read-only EVM event indexer + query API (token balances,
               NFT ownership, transfers). Shares Engine chain config and API keys.
  dashboard/   Developer-facing web UI (React) for managing projects,
               API keys, backend wallets, and contract deployments.
  cli/         `apkaya deploy` / `apkaya create` command line tool.
  mobile-example-rn/      Expo demo for @apkaya/mobile-sdk.
  mobile-example-flutter/   Flutter demo for apkaya_flutter_sdk.

packages/
  sdk/         TypeScript client SDK that wraps the Engine REST API and
               adds contract/wallet helpers for frontend & backend use.
  mobile/      React Native SDK (@apkaya/mobile-sdk).
  flutter-sdk/ Flutter SDK (apkaya_flutter_sdk).
  unity-sdk/   Unity UPM package (C#) — Engine + Insight + SIWE/WC connect.
  unreal-sdk/  Unreal plugin (C++) — Engine + Insight + SIWE/WC connect.
  connect/     End-user wallet connect modal + SIWE (web/React).
  contracts/   Solidity contract templates (ERC20, ERC721, ERC1155 +
               extensions) and deployment scripts.
```

## Build order (v0 roadmap)

1. **Engine** — transaction queue, backend wallets, send/status endpoints. ✅ done
2. **Contracts** — ERC20/721/1155 templates + deploy script callable from Engine. ✅ done (ERC20 + ERC721 drop)
3. **SDK** — thin TS client over Engine's REST API. ✅ done
4. **Dashboard** — minimal UI to create backend wallets, send test transactions,
   browse registered contracts (read/write via ABI), and watch the queue drain. ✅ done
5. **CLI** — scaffolding + deploy convenience commands. ✅ done (`apkaya login/create/deploy/wallet/tx/apikey`)
6. **Connect** — end-user wallet modal + in-app email wallet + SIWE. ✅ done (Phase 4)
7. **Bridge** — BuyWidget / SwapWidget via Coinbase CDP. ✅ done (Phase 4B)
8. **Insight** — EVM event indexer + read API for balances, NFTs, transfers. ✅ done (Phase 5)
9. **Self-host polish** — docker-compose full stack, QUICKSTART, root `.env`, `npm run dev`. ✅ done (Phase 6)
10. **Mobile SDKs** — React Native (`@apkaya/mobile-sdk`) + Flutter (`apkaya_flutter_sdk`). ✅ done (Phase 7)
11. **Game engine SDKs** — Unity (`packages/unity-sdk`) + Unreal (`packages/unreal-sdk`). ✅ done (Phase 8)
12. **Non-EVM (Solana)** — ChainAdapter refactor, Solana wallets/transfers, Insight slot indexer. ✅ done (Phase 9)

## Beyond v0

- **Per-customer API keys** — done. Engine now issues hashed, individually
  revocable keys via a separate admin-only key (`ENGINE_ADMIN_KEY`), rather
  than a single shared static secret. See `apps/engine/README.md#api-keys-admin-only`.

## Running locally

See **[QUICKSTART.md](QUICKSTART.md)** for the full clone → deploy → transfer → Insight walkthrough.

**Docker (whole platform):**

```bash
cp .env.example .env          # set DEPLOYER_PRIVATE_KEY for contract deploys
npm run env:sync
docker compose up -d --build  # postgres + engine + insight + dashboard
```

**Native dev (single command):**

```bash
cp .env.example .env && npm run env:sync
npm run dev                   # postgres via compose; boots all app processes
```

Dashboard: [http://localhost:5173](http://localhost:5173) · Engine: `:3005` · Insight: `:3006`


## Why Engine first?

It's the most reusable, self-contained piece: a stateless-ish HTTP API in
front of a durable Postgres-backed queue. Everything else (dashboard, SDK,
contract deploys) is a client of it. Get this right and the rest of the
platform is "just" UI and templates on top.

See `apps/engine/README.md` for the service-specific docs.
See `apps/insight/README.md` for the indexer API.
See [QUICKSTART.md](QUICKSTART.md) for the self-host walkthrough.
