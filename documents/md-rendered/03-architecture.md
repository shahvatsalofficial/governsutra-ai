# Architecture

GovernSutra is a small, layered, dependency-free system. Core logic is deterministic and offline; AI IDEs may add reasoning on top through portable instruction files, but the engine never needs a model.

## Layers
| Layer | Module | Responsibility |
|---|---|---|
| Experience | `packages/cli`, `packages/reporting` | Strict argument parsing; one block list rendered to Markdown and HTML so formats agree |
| Application | `packages/core/index.mjs` | Workspace, registry, assessment, evidence, audit chain, manifest import |
| Policy | `core/policy.mjs`, `core/model.mjs` | Ten rules, exception logic, validation, risk indicator |
| Discovery | `core/scan.mjs`, `core/diff.mjs` | Bounded readers, lockfile and manifest parsers, change diff |
| Assurance | `core/audit.mjs`, `core/util.mjs` | 31 hostile-input checks, canonical JSON, SHA-256 seal |
| Adapters | `core/install.mjs`, `adapters/ide/*` | Project-local instruction files for 9 hosts |
| API | `packages/server` | Read-only loopback HTTP |
| Persistence | `.governsutra/` | JSON registry, evidence index, `audit.jsonl` hash chain |

## Data flow
```
repo files --(allowlist, 2 MiB cap, no symlink)--> scan --> candidates (observed)
owner JSON --> register / import-manifests --> registry (declared)
file --(sha256, path containment)--> evidence index (digest only)
registry + evidence --> evaluateRules + computeRisk --> assessment (HUMAN_REVIEW_REQUIRED)
assessment --> renderMarkdown / renderHtml / JSON
every write --> appendAudit (prevHash -> hash)
```

## Design decisions
1. **Unknown is a first-class state.** Rules never default to pass; missing risk inputs score mid-scale and are listed.
2. **Declared versus observed versus decided.** Scan results are observed candidates, manifests and registry entries are owner declarations, decisions are human. They are stored with provenance and never merged silently.
3. **One renderer source.** `blocks()` builds neutral blocks used by both Markdown and HTML, with escaping at the edge (HTML entities, Markdown punctuation).
4. **Path containment with `path.relative`.** Works on Windows and POSIX; symlinks are refused.
5. **No new dependencies.** Supply-chain exposure is zero by construction; a parser is added only after review (YAML is deferred for this reason).
6. **Seals, not signatures.** Canonical JSON plus SHA-256 detects change. Real signing needs key management and is on the roadmap.

## Trust boundaries
Repository and imported artifacts are untrusted. Evidence is referenced by digest, never copied into prompts. `.env` values, credentials, raw data and private prompts are excluded. The API is loopback-only and read-only. External connectors are off until separately reviewed.

## Future production topology (planned, not built)
Web UI, API gateway, OIDC/SSO, RBAC/ABAC, tenant isolation, database with migrations, encryption at rest, key management, signed audit events, immutable storage, backups, observability, penetration test. The current tool is not multi-tenant software.

See also the [threat model](06-security-and-privacy) and [technical reference](04-technical-reference).
