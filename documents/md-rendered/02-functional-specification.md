# Functional Specification

What GovernSutra 0.2.0 does, per capability. Each row names the command and the proof.

## Capabilities
| ID | Capability | Command | Behavior |
|---|---|---|---|
| F1 | Initialize workspace | `init` | Creates `.governsutra/` with registry, policies, evidence index, empty audit chain. Idempotent. |
| F2 | Register a system | `register --input FILE` | Validates the record; rejects duplicate or unsafe IDs, missing owner or purpose, bad enums, invalid control status. Writes an audit event. |
| F3 | Import repository manifests | `import-manifests --repo DIR` | Loads `governance/ai-systems/*.json`; verifies optional `integrity.sha256`; registers valid ones as unconfirmed repository declarations; never overwrites an existing ID. |
| F4 | Assess | `assess --id ID` | Evaluates ten rules, risk indicator, completeness, unknowns; emits JSON, Markdown or HTML. Decision is always `HUMAN_REVIEW_REQUIRED`. |
| F5 | Report | `report --id ID --out DIR` | Writes `assessment.json`, `.md`, `.html`. |
| F6 | Scan | `scan --repo DIR` | Candidate discovery with file digest, JSON pointer and line. |
| F7 | Diff | `diff --a A --b B` | Compares two system records or two scans; lists changes and re-review triggers. |
| F8 | Evidence | `evidence add` / `evidence verify` | Hash a file by reference (expiry, verifier optional); re-hash later to find drift, missing files, expiry. Exit code 2 on any problem. |
| F9 | Audit chain | `audit verify` | Verifies sequence, previous-hash links and event hashes. |
| F10 | Independent-style audit | `audit --out DIR` | Runs 31 checks; writes sealed JSON, MD and HTML. Exit 2 on failure. |
| F11 | Seal verify | `verify --report FILE` | Recomputes the canonical SHA-256 seal. |
| F12 | Install IDE adapter | `install-ide --host H --target DIR` | Copies host instructions plus agents, skills, rules, workflows, schemas. `--dry-run`, `--force`. |
| F13 | Local API | `serve` | Read-only, loopback, bearer token. |
| F14 | Doctor | `doctor` | Node version, hosts, offline status. |

## The ten rules
| Rule | Question | Pass requires |
|---|---|---|
| GOV-001 | Named accountability | owner and risk owner present |
| GOV-002 | Intended-use boundaries | intended use and at least one prohibited use |
| GOV-003 | No compliance claims | engine design rule (always pass; tested by audit) |
| GOV-004 | Evidence provenance | verified controls resolve to hashed evidence and a named verifier, none expired |
| GOV-005 | Data minimization | data sources declared, none with raw data attached |
| GOV-006 | Human decision authority | each checkpoint names role and authority |
| GOV-007 | Version traceability | every model and tool records a version |
| GOV-008 | Risk uncertainty visible | all six risk inputs declared |
| GOV-009 | Least privilege | every tool lists permissions |
| GOV-010 | Lifecycle review | active or in-review system has a future review date |

Statuses: `pass`, `fail`, `unknown`, `not-applicable`, `exception-approved`. See [Evidence model and rules](07-evidence-model-and-rules).

## Control statuses
`planned`, `implemented`, `evidence-attached`, `verified-by-named-reviewer`, `failed`, `unknown`, `not-applicable`, `exception-approved`. Only `verified-by-named-reviewer` with evidence and a verifier can satisfy GOV-004. File presence is never verification.

## Exceptions
Valid only with: named **human** approver, rationale, scope, target rule, and a future expiry. Agent approvers are invalid. An expired or invalid exception leaves the rule failing and says why.

## Non-functional requirements
Offline; Node 22+; zero dependencies; 2 MiB per file; 200 manifests; Windows, macOS and Linux CI; deterministic output except timestamps.

## Out of scope
Legal classification, compliance verdicts, certification, runtime monitoring of AI systems, collecting raw personal data or secrets.
