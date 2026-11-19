# Plugin, Tool and Server Integration Catalog

## Implemented in the starter
- Local repository discovery for package manifests and selected MCP configuration files.
- Deterministic local policy pack.
- Evidence references with SHA-256 digests.
- Token-protected read-only localhost API.
- Project-local IDE instruction adapters.

## Candidate integrations (not installed or tested here)
| Integration | Why | Security boundary |
|---|---|---|
| MCP read-only server | Let coding assistants query inventory and assessments | Read-only scopes, explicit user consent, authenticated transport, audit events; no write tools by default. |
| GitHub Actions / GitLab CI / Azure Pipelines | Attach review packets to pull requests | CI identity with read-only repo permissions; never auto-approve. |
| MLflow / model registries | Model lineage and version metadata | Metadata-only scopes; no model weights or training data by default. |
| DataHub / OpenMetadata | Data-source ownership and lineage | Metadata only; no raw data rows. |
| SQLite / PostgreSQL | Shared durable registry | Migrations, encryption, RBAC, tenant isolation and backup tests. |
| OIDC / SSO | Enterprise identity | Least privilege, short-lived tokens, auditable role mapping. |
| OpenTelemetry | Runtime evidence metadata | Minimize telemetry; never collect prompt or personal content by default. |

Install nothing globally without explicit approval. Every integration requires version pinning, threat model, negative tests, permission review and documented data flows.
