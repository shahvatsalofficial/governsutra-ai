# Roadmap and FAQ

## Roadmap
| Milestone | Scope | Status |
|---|---|---|
| M0 | Registry, CLI, risk indicator, scanner, evidence, audit chain, reports, API, agents, skills, adapters | Done (0.1.0) |
| M1 | Lockfiles, manifests with digests, pointers, diffs | Done (0.2.0); YAML and signed manifests planned |
| M2 | Organization policy packs, control and evidence lifecycle queues, exception expiry reminders | Planned |
| M3 | Accessible dashboard, dependency graph, review tasks | Planned |
| M4 | Database, SSO, RBAC, tenant isolation, encryption, signed audit | Planned |
| M5 | Read-only MCP server, CI adapters, model registry and data catalog connectors | Planned |

A roadmap item is not a feature. See [ROADMAP](https://github.com/shahvatsalofficial/governsutra-ai/blob/main/ROADMAP.md).

## FAQ
**Does this make me compliant with the EU AI Act, ISO 42001 or NIST AI RMF?** No. It organizes evidence and flags gaps in your own declarations. Compliance is a legal and organizational judgment.

**Does it classify my system's risk category?** No. The 0-100 score is an internal prioritization indicator. It is not an EU AI Act tier or any legal category.

**Why is everything `HUMAN_REVIEW_REQUIRED`?** By design. Tools and agents may prepare recommendations; named humans decide.

**Why `unknown` instead of pass?** Missing or stale evidence proves nothing. Showing it as unknown keeps gaps visible.

**Does it send my data anywhere?** No. There are no network calls. The optional API is loopback only.

**Does it read my `.env` files or secrets?** No. It notes that `.env` exists and refuses key-like files as evidence.

**Is the audit report an independent audit?** It is automated self-assurance: the tool runs hostile-input checks on its own code. A third-party audit needs a qualified human. The report says so.

**Are the 20 agents running services?** No. They are portable instruction files. Native execution in each IDE is not verified.

**Why not YAML manifests?** A YAML parser would be the first dependency. It is deferred until reviewed. JSON works today.

**How do I prove the report was not edited?** `governsutra verify --report FILE` recomputes the SHA-256 seal. This detects edits, not authorship. Signing is planned.

**Can I use it in CI?** Yes: `npx governsutra-ai audit --out out` returns exit code 2 on failure; `evidence verify` returns 2 on drift.

**Which Node versions?** 22 and newer; CI covers 22 and 24.
