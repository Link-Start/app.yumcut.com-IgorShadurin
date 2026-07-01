# Agent Instructions

## Email Rules

Email-writing instructions live in [email/AGENTS.md](email/AGENTS.md).

## Commit Rules

- After completing the requested feature, commit all changes.
- Use Conventional Commits format, for example: `fix(scope): short message`, `feat: short message`, `chore: short message`.

## Deploy and Dependency Fix Rules

- Treat production deploy failures, `npm ci` failures, lockfile sync errors, and audit/dependency failures as repository bugs until proven otherwise. Fix the repo state, commit it, and push it; do not present `npm install` on the server as the final fix.
- When `npm ci` reports missing packages from `package-lock.json`, inspect the exact dependency path and add/update the lockfile entries that satisfy that path. Do not rely only on a macOS/local `npm ci --dry-run` if the failure happens on Linux.
- For dependency or lockfile fixes, verify with the closest production command available. For Linux deploy issues, run `npm ci --dry-run --os=linux --cpu=x64` in addition to the normal local check when relevant.
- If `npm audit fix` or any dependency command rewrites the lockfile, rerun the deploy-oriented `npm ci` checks afterward; dependency rewrites can undo a previous lockfile fix.
- When a lockfile/deploy issue is subtle or platform-specific, add a focused regression test or script check that validates the invariant, so the same broken lockfile shape cannot be committed again.

## UI Cursor Rules

- For clickable or interactive UI elements, explicitly apply a clickable cursor style (for example `cursor-pointer`) by default.
- Only skip the clickable cursor when there is a clear reason or explicit instruction not to use it (for example disabled states or intentionally non-interactive elements).

## Debug Auth Notes

- Local debug instructions for signing into web admin in Chrome MCP without OAuth are documented in [docs/debug-web-admin-login.md](docs/debug-web-admin-login.md).

## Image Prank Catalog Notes

- Instructions for generating and importing Image Prank catalog characters are documented in [docs/image-prank-character-generation.md](docs/image-prank-character-generation.md).
