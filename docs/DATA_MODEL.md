# Data Model

Stable, human-readable IDs; schema version on every record. Observed facts, owner declarations, external statements, agent hypotheses and human decisions are kept apart (`provenance.kind`).

- **AISystem**: `id`, `name`, `description`, `intendedUse`, `prohibitedUses[]`, `owner`, `riskOwner`, `lifecycle` (`draft|in-review|active|suspended|retired`), `businessUnit`, `deploymentContext`, `affectedPeople[]`, `nextReviewAt`, `provenance`.
- **ModelComponent**: `provider`, `name`, `version`, `deployment`, `provenance`.
- **ToolComponent**: `name`, `version`, `transport`, `permissions[]`, `owner` (MCP servers, plugins, tools).
- **DataSource**: `name`, `category`, `origin`, `sensitivity`, `retention`, `rawDataAttached` (must be false).
- **HumanCheckpoint**: `stage`, `role`, `authority`, `evidence`.
- **Control**: `id`, `name`, `status` (one of `planned`, `implemented`, `evidence-attached`, `verified-by-named-reviewer`, `failed`, `unknown`, `not-applicable`, `exception-approved`), `evidenceIds[]`, `verifier`.
- **Exception**: `id`, `ruleId`, `rationale`, `scope`, `approver {name, type: "human"}`, `expiresAt`, optional `compensatingControls[]`. Invalid unless approver type is `human`.
- **EvidenceReference**: `id`, `systemId`, `kind`, `relativePath`, `sha256`, `sizeBytes`, `scope`, `recordedAt`, `expiresAt`, `verifier`, `limitations`, `status`. Content is never copied.
- **AuditEvent**: `seq`, `timestamp`, `actor`, `action`, `entityId`, `details`, `prevHash`, `hash`.
- **Risk inputs**: `decisionImpact` (1-5), `autonomy`, `dataSensitivity`, `exposure`, `modelOpacity` (1-5), `humanOversight`.

## Repository manifest: `governance/ai-systems/<name>.json`
A system record (same shape as AISystem) in a repository. Optional `integrity: {"sha256": "<hex>"}` where the digest is SHA-256 of the canonical JSON (sorted keys) of the record without `integrity`. Status after load: `valid`, `invalid`, `invalid-json`, `digest-mismatch` or `skipped`. A digest detects edits; it is not a signature. Imported manifests are recorded with `provenance.kind = repository-manifest` and `confirmedByOwner = false`.

Schemas: [`schemas/`](../schemas/). Sensitive data stays in its source system; GovernSutra stores metadata and digests only.
