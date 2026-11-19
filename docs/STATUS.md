# Implementation Status — 2026-11-19 (v0.2.0)

Status vocabulary: `implemented` = code exists and tests cover it; `planned` = design only; `not verified` = no execution evidence. Planned work is never shown as complete.

## Implemented and tested
| Area | Evidence |
|---|---|
| Registry, schema validation, duplicate and unsafe-ID rejection | `tests/core.test.mjs`, `tests/features.test.mjs` |
| Ten rules, five statuses, reasons and owner actions | `features.test.mjs` (rule tests), audit checks A10-A15 |
| Exceptions (human approver, expiry, reopen) | audit checks A13-A15 |
| Risk indicator, missing-data behavior, sensitivity | `features.test.mjs`, A10 |
| Scanner: package.json, package-lock v1-v3, requirements, pyproject, poetry.lock, uv.lock, MCP configs, CI actions | `features.test.mjs`, fuzz in `docs/proof/fuzz-results.json` |
| Manifests `governance/ai-systems/*.json` with `integrity.sha256` | A21-A24 |
| Diff with re-review triggers | A26, diff tests |
| Evidence references, expiry, verifier, drift | `features.test.mjs` |
| Hash-chained audit log | A01-A02 |
| Reports: JSON, Markdown, HTML; sealed audit report | A16, A29, CLI tests |
| Read-only loopback API | A19-A20, `server.test.mjs` |
| `install-ide` for 9 hosts, overwrite protection, traversal refusal | A27-A28, CLI tests |
| 20 agents, 26 skills, 10 rules, 8 workflows present | A30-A31 |

Run `npm test` and `npm run proof` to reproduce. Recorded numbers: [`docs/proof/environment.json`](proof/environment.json).

## Not implemented / not verified
- No dashboard or multi-user web app; no database; no SSO, RBAC, tenant isolation or encryption at rest.
- No MCP server (a read-only MCP server is planned, M5); no external connectors; YAML manifests are not parsed.
- No digital signatures: seals and hash chains detect change but do not prove authorship.
- Native execution of the 20 agents and 26 skills inside each IDE is **not verified**; adapters are instruction files.
- No legal classification, compliance determination, certification or independent third-party audit.
- Behavior on macOS and Linux is covered by the CI matrix when green; see the repository Actions tab. Local proof was produced on the host named in `environment.json`.
