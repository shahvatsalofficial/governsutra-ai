# Threat Model

## Assets
System inventory, owner identities, risk records, model/tool metadata, evidence paths and audit history.

## Threats
- Prompt injection through repository docs, model cards, issue text or MCP tool descriptions.
- Secret leakage through `.env`, credentials, private prompts or raw data.
- False governance confidence from missing or stale evidence.
- Unauthorized modification of registry or audit log.
- Malicious path traversal, symlink substitution or oversized evidence files.
- Token theft or accidental exposure of local API beyond loopback.
- Untrusted plugin/connector with excessive scopes.
- Confused-deputy behavior in an agent acting across repos or tenants.

## Controls in starter
- Allowlisted manifest discovery; `.env` values are never read.
- Evidence path containment, symlink rejection and size cap.
- Hash-linked audit events and verification command.
- Read-only API, bearer token, no CORS and loopback bind from CLI.
- No network or AI-provider calls in core.
- Unknown states and explicit non-certification language.

## Residual risks
Local JSON files can be edited by an OS user; hash chain is not signed. API token is operator-managed and has no rotation UI. No multi-user RBAC, SSO, encryption-at-rest, tenant isolation, remote threat protection or production hardening. Do not expose the local server publicly.
