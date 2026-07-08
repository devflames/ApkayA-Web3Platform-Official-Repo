# Security Policy

## Supported Versions

This project is currently developed on the `main` branch. Security fixes are applied to `main` first.

## Reporting a Vulnerability

Please **do not** open public GitHub issues for security vulnerabilities.

- Email: `devflames@gmail.com`
- Subject: `SECURITY: ApkayA-Web3Platform vulnerability report`

Include (as applicable):
- A clear description of the issue and impact
- Steps to reproduce (proof-of-concept is helpful)
- Affected components (e.g. `apps/engine`, `apps/insight`, `apps/dashboard`, `packages/*`)
- Any logs, request/response samples, and environment details

## Response & Disclosure

- We’ll acknowledge receipt within **72 hours**
- We’ll work on a fix and coordinate a responsible disclosure timeline

## Hardening Guidance (Self-hosters)

- Never expose `ENGINE_ADMIN_KEY` to browsers, mobile apps, or game clients
- Rotate `ENGINE_ADMIN_KEY`, `ENGINE_ACCESS_KEYS`, and all third-party API keys regularly
- Use a real mail provider for OTP flows in production and keep `ENGINE_AUTH_DEV_LOG_OTP` disabled
- Lock down `DATABASE_URL` access and keep Postgres off the public internet
- Prefer TLS and a reverse proxy (Caddy/Nginx) for internet-facing deployments
