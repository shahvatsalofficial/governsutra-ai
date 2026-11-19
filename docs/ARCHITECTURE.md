# Architecture

## Product boundary
GovernSutra is a local-first governance engineering system of record for AI system declarations and evidence references. It does not run or control the governed model. It does not decide legal applicability, certify controls or approve production releases.


## Architecture views

| View | GovernSutra design responsibility |
|---|---|
| Business architecture | AI inventory ownership, review accountability, risk acceptance and lifecycle governance. |
| Capability architecture | Discover, register, assess, map controls, collect evidence, review changes, audit and retire. |
| Domain architecture | AI systems, models, tools, data sources, affected people, checkpoints, controls, evidence, exceptions and decisions. |
| Application architecture | CLI commands, deterministic services, policy evaluation, reporting and read-only API. |
| Component architecture | Core domain library, CLI adapter, server adapter, scanner, evidence store and report renderer. |
| Data architecture | Versioned JSON records, schemas, evidence references, audit event chain and future relational adapter. |
| Integration architecture | IDE instructions, repository manifests, future MCP, CI, model registry and data catalog adapters. |
| Security architecture | Least privilege, no-secret scanning, path containment, token-gated read API and explicit human consent. |
| Deployment architecture | Local workstation first; future self-hosted topology requires separate identity, tenant, encryption and network design. |
| Operations architecture | Tests, status reporting, evidence freshness, release checklist, backups and incident response roadmap. |
| Experience architecture | CLI-first, accessible reports and future responsive dashboard with explicit unknown states. |

## Layers
1. **Experience** — CLI, Markdown/JSON/HTML review reports, future dashboard.
2. **Orchestration** — GovernSutra Prime plus bounded specialist agent contracts and eight workflows.
3. **Domain** — AI system, model, tool, data source, affected person, control, evidence, exception, review and audit event.
4. **Application services** — register, inventory, assess, evidence capture, change review, report and audit verification.
5. **Policy** — deterministic configurable rules with pass/fail/unknown/not-applicable states.
6. **Adapters** — project-local IDE instructions, repository manifests, future MCP/CI/model registry/data catalog connectors.
7. **Persistence** — local JSON registry, evidence index, SHA-256 digests and hash-chained JSONL audit events.
8. **Operations** — Node.js CLI, read-only loopback API, tests and documentation.

## Risk model
The default indicator uses six configurable factors: decision impact (25%), autonomy (20%), data sensitivity (20%), deployment exposure (15%), model transparency gap (10%) and human oversight gap (10%). Each factor is normalized to 1–5. The resulting 0–100 score is only a triage signal; it is not a statutory category or safety score. Unknown inputs remain visible and use conservative neutral/high defaults as defined in code.

## Trust boundaries
- Repository and imported artifacts are untrusted.
- Evidence is hashed and referenced, not copied into model prompts.
- `.env` values, credentials, raw data and private prompts are excluded.
- HTTP API is read-only, bearer-token protected and loopback-bound by CLI.
- External connectors are disabled until explicit authorization and separate review.

## Future production topology
A production service needs a dedicated architecture: web UI, API gateway, OIDC, RBAC/ABAC, tenant isolation, database migrations, encryption-at-rest, key management, signed audit events, object storage, backups, observability, incident response, disaster recovery, secure CI/CD and penetration testing. The starter is not production multi-tenant software.
