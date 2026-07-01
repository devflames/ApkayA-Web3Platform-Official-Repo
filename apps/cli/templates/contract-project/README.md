# {{PROJECT_NAME}}

A smart contract project scaffolded with `apkaya create`.

## Getting started

```bash
npm install
npm run compile
```

## Deploy

```bash
apkaya login          # if you haven't already
apkaya deploy
```

`apkaya deploy` reads the compiled artifact from `artifacts/contracts/`,
prompts you for constructor arguments and which network to deploy to, then
broadcasts the deployment using a private key you provide (or via a backend
wallet on your Engine instance — see `apkaya deploy --help`).
