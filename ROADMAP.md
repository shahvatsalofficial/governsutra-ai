# Roadmap

A roadmap item is **not** an implemented capability. Items move to done only with code, tests and evidence.

## Done (0.2.0, tested)
- [x] AI system registry with ownership, purpose, model/tool/data declarations and human checkpoints.
- [x] Ten rules with pass / fail / unknown / not-applicable / exception-approved; exceptions with human approver and expiry.
- [x] Risk indicator with published weights, missing-data behavior and sensitivity view.
- [x] Allowlisted discovery incl. lockfiles, MCP configs, CI actions, and `governance/ai-systems/*.json` manifests with digests.
- [x] Change diff with re-review triggers.
- [x] Evidence SHA-256, expiry, verifier, drift detection; hash-chained audit log.
- [x] Reports and sealed audit report in Markdown, HTML and JSON.
- [x] Read-only loopback API; nine IDE adapter templates; 20 agent roles; 26 skills; 8 workflows.

## Next (M1 remainder, M2)
- [ ] YAML manifests (needs a reviewed parser decision; the core stays dependency-free).
- [ ] Signed manifests and scanner metadata (key management design first).
- [ ] pnpm and yarn lockfiles; SBOM (CycloneDX) and model-card ingestion.
- [ ] Versioned organization policy packs; control and evidence lifecycle queues.
- [ ] Prompt and configuration artifact references with change detection.

## Later
- [ ] M3: accessible responsive dashboard, dependency graph, review tasks, export.
- [ ] M4: SQLite/PostgreSQL adapter, SSO/OIDC, RBAC, tenant isolation, encryption, signed audit log, backups.
- [ ] M5: read-only MCP server, CI adapters (GitHub, GitLab, Azure), model registry and data catalog connectors, host-version compatibility matrix.
- [ ] Framework mapping packs with versioned sources and qualified legal review.

## Will not be built
Automatic legal classification, compliance or certification verdicts, automated approval of exceptions or releases, collection of raw personal data or secrets.
