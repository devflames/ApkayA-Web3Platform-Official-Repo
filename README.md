# ApkayA Web3Platform

An open, self-hostable developer infrastructure platform for building on-chain
apps — contracts, wallets, and a transaction backend — inspired by the
architecture of thirdweb (https://thirdweb.com).

## Monorepo layout

```
apps/
  engine/      Transaction backend: queues, signs, and sends blockchain
               transactions. Manages backend wallets. Exposes a REST API.
               This is the core, independently-deployable service.
  dashboard/   Developer-facing web UI (React) for managing projects,
               API keys, backend wallets, and contract deployments.
  cli/         `apkaya deploy` / `apkaya create` command line tool.

packages/
  sdk/         TypeScript client SDK that wraps the Engine REST API and
               adds contract/wallet helpers for frontend & backend use.
  contracts/   Solidity contract templates (ERC20, ERC721, ERC1155 +
               extensions) and deployment scripts.
```

## Build order (v0 roadmap)

1. **Engine** — transaction queue, backend wallets, send/status endpoints. ✅ done
2. **Contracts** — ERC20/721/1155 templates + deploy script callable from Engine. ✅ done (ERC20 + ERC721 drop)
3. **SDK** — thin TS client over Engine's REST API. ✅ done
4. **Dashboard** — minimal UI to create backend wallets, send test transactions,
   and watch the queue drain. ✅ done (wallets, transactions, chains, settings)
5. **CLI** — scaffolding + deploy convenience commands. ✅ done (`apkaya login/create/deploy/wallet/tx/apikey`)

## Beyond v0

- **Per-customer API keys** — done. Engine now issues hashed, individually
  revocable keys via a separate admin-only key (`ENGINE_ADMIN_KEY`), rather
  than a single shared static secret. See `apps/engine/README.md#api-keys-admin-only`.

## Running the dashboard

```bash
# from the repo root — installs all workspaces, including linking
# @apkaya/sdk into the dashboard via the npm workspace
npm install

docker compose up postgres -d

cd apps/engine && cp .env.example .env   # set WALLET_ENCRYPTION_KEY, ENGINE_ADMIN_KEY
cd apps/engine && npm run dev            # terminal 1 — API on :3005
cd apps/engine && npm run worker         # terminal 2 — tx worker
cd apps/dashboard && npm run dev         # terminal 3 — opens on :5173
```
Then open the dashboard, go to **Settings**, and point it at your Engine
instance (`http://localhost:3005` + one of your `ENGINE_ACCESS_KEYS` values).


## Why Engine first?

It's the most reusable, self-contained piece: a stateless-ish HTTP API in
front of a durable Postgres-backed queue. Everything else (dashboard, SDK,
contract deploys) is a client of it. Get this right and the rest of the
platform is "just" UI and templates on top.

See `apps/engine/README.md` for the service-specific docs.
