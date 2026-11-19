# Security and Privacy

## Assets and threats
| Threat | Mitigation in code | Proof |
|---|---|---|
| Prompt injection via repository text, model cards or MCP descriptions | Content is treated as data; the engine never executes or follows it; reports escape it | audit A16, fuzz renderer cases |
| Secret leakage (`.env`, keys, credentials) | `.env` content never read; `.pem/.key/.ssh/.aws` refused as evidence; URL credentials redacted | A05, A07, A08 |
| Path traversal | `path.relative` containment, workspace itself refused | A03 |
| Symlink substitution | `lstat` rejection plus realpath containment | A04, A09 |
| Oversized or hostile files | 2 MiB cap, 200 manifests, bounded parsing, fuzzed | A06, A23, fuzz |
| Log tampering | SHA-256 hash chain (detects edits, deletes, reorders) | A01, A02 |
| Report tampering | Canonical SHA-256 seal | A29 |
| API abuse | Loopback only, bearer token, GET only, no CORS, rate limit | A19, A20 |
| Adapter overwrite and host traversal | Plan-then-copy, `--force`, strict host regex | A27, A28 |
| False confidence | Unknown is not pass; decisions always need a human | A10-A15, A17, A18 |
| Supply chain | Zero dependencies; SHA-pinned CI actions; npm provenance | `npm ls` |

## Privacy
No network, telemetry, account or API key. Data kept: system metadata you enter, SHA-256 digests, relative evidence paths, audit events. Not kept: file content, `.env` values, prompts, personal data. You are responsible for what you type into records; do not register real customer data.

## Residual risks
- Anyone who can edit the workspace files can rewrite the whole chain and recompute hashes. Store the head hash (`audit verify` prints it) somewhere separate, or add signing later.
- The scanner cannot recognise every secret or every AI usage; it reads declared manifests only.
- Owner declarations can be wrong. Rules check structure and evidence, not truth.
- No encryption at rest, RBAC or multi-user isolation. Do not expose `serve` beyond loopback.
- Windows lacks unprivileged symlinks, so two symlink checks may be skipped there; Linux and macOS CI run them.

## Reporting a vulnerability
Private GitHub security advisory. See `SECURITY.md`.
