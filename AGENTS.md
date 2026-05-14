# Agent Instructions

## Email Rules

Email-writing instructions live in [email/AGENTS.md](email/AGENTS.md).

## Commit Rules

- After completing the requested feature, commit all changes.
- Use Conventional Commits format, for example: `fix(scope): short message`, `feat: short message`, `chore: short message`.

## UI Cursor Rules

- For clickable or interactive UI elements, explicitly apply a clickable cursor style (for example `cursor-pointer`) by default.
- Only skip the clickable cursor when there is a clear reason or explicit instruction not to use it (for example disabled states or intentionally non-interactive elements).

## Debug Auth Notes

- Local debug instructions for signing into web admin in Chrome MCP without OAuth are documented in [docs/debug-web-admin-login.md](docs/debug-web-admin-login.md).
