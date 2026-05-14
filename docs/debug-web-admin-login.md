# Debug Web Admin Login (Chrome MCP, No OAuth)

This document describes a local-only way to open the web app as an existing admin user in Chrome MCP without using Google/Apple OAuth and without changing app code.

## Scope

- Intended for local debugging on `localhost`.
- Uses existing DB user + `NEXTAUTH_SECRET`.
- Does not add production login functionality.

## Prerequisites

- App is running locally (for example `http://localhost:3001`).
- `.env` has valid `NEXTAUTH_SECRET`.
- At least one admin user exists in DB (`isAdmin=true` and `deleted=false`).

## Why this works

- Web auth uses NextAuth JWT session cookies (`next-auth.session-token` on local HTTP).
- If you mint a valid session token for an admin user and set it as cookie for `localhost`, the UI becomes authenticated.

## One-time local helper flow

1. Resolve an existing admin user from DB.
2. Mint JWT with `next-auth/jwt` `encode(...)` using:
   - `secret: NEXTAUTH_SECRET`
   - token payload with admin user identity (`sub`, `email`, `name`, `isAdmin`)
3. Start a temporary local HTTP helper endpoint (for example `http://localhost:3123/login`) that:
   - sets `next-auth.session-token=...` cookie for `localhost`
   - redirects to the target project URL
4. Open `http://localhost:3123/login` in Chrome MCP.
5. Verify authenticated UI (account menu should show admin identity).
6. Stop helper and remove temporary helper file.

## Notes and caveats

- Use `localhost`, not `127.0.0.1`, if app runs on `localhost` (cookie host must match).
- This is a local debug bypass only. Never expose helper endpoint publicly.
- If `NEXTAUTH_SECRET` rotates, previously minted cookies become invalid.
