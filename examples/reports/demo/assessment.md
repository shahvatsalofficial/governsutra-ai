# GovernSutra AI — System Assessment: Customer Support Knowledge Assistant

> **Decision:** `HUMAN_REVIEW_REQUIRED` — Automated checks never approve a system, an exception or a release. A named human owner decides.

**System:** Customer Support Knowledge Assistant \(AI-SYS-001\)  
**Lifecycle:** in-review  
**Generated:** 2026-11-19T18:59:53.222Z  
**Review scope:** Registry record plus attached evidence references only. No runtime, code or data inspection.  
**Data cutoff (record last updated):** 2026-11-19T18:59:53.207Z  
**Record provenance:** owner-declared  
**Internal risk indicator:** 42/100 \(moderate\) — risk-model/1.0  
**Inventory completeness:** 100% \(9/9\)  
**Unknown risk inputs:** none  

## Policy rules (pass, fail, unknown, not-applicable, exception-approved)

| Rule | Title | Severity | Status | Reason |
|---|---|---|---|---|
| GOV-001 | Named accountability | high | pass | Owner and risk owner are named \(owner declaration, not verified\). |
| GOV-002 | Intended use and boundaries | high | pass | Intended and prohibited uses are documented \(owner declaration\). |
| GOV-003 | No compliance claims | block | pass | Engine design rule: output always requires human review and never states compliance. |
| GOV-004 | Evidence provenance | high | unknown | No control is verified by a named reviewer; presence of a file is not verification. |
| GOV-005 | Data minimization | block | pass | Data sources declared as metadata with no raw data attached \(owner declaration\). |
| GOV-006 | Human decision authority | high | pass | Human checkpoints name a role and authority \(declared; actual intervention not evidenced\). |
| GOV-007 | Version traceability | medium | pass | All declared models and tools record a version. |
| GOV-008 | Risk uncertainty visible | block | pass | All risk inputs are declared. |
| GOV-009 | Least privilege and tool consent | high | pass | Every tool lists its permission scopes \(declared\). |
| GOV-010 | Lifecycle review and expiry | medium | pass | Next review 2027-02-17. |

## Risk factors and assumptions

| Factor | Value (1-5) | Weight % | Known? | Score if 1 | Score if 5 |
|---|---|---|---|---|---|
| Decision impact | 3 | 25 | declared | 32 | 52 |
| System autonomy | 2 | 20 | declared | 38 | 54 |
| Data sensitivity | 2 | 20 | declared | 38 | 54 |
| Deployment exposure | 1 | 15 | declared | 42 | 54 |
| Model transparency gap | 3 | 10 | declared | 38 | 46 |
| Human oversight gap | 1 | 10 | declared | 42 | 50 |

_Unknown inputs are scored 3 of 5 \(mid-scale\) and listed in unknownFactors; they are never treated as low._

## Models, tools and data sources (owner declarations)

| Kind | Name | Version / sensitivity | Detail |
|---|---|---|---|
| model | Example Model Provider Support-LLM | 2026-10-15 | hosted-api |
| tool | Knowledge Search MCP | 1.2.0 | read:approved-knowledge |
| data | Approved knowledge base | internal | internal-business-content · retention source-system policy |

## Control status

| Control | Name | Status | Evidence refs |
|---|---|---|---|
| CTRL-HUMAN-01 | Human review before send | implemented | 0 |

## Evidence references (digest only, content never copied)

| ID | Kind | Path | SHA-256 | Recorded | Expires |
|---|---|---|---|---|---|
| - | - | no evidence attached | - | - | - |

## Exceptions

| ID | Rule | State | Approver | Expires |
|---|---|---|---|---|
| - | - | none recorded | - | - |

## Unknowns

- GOV-004: No control is verified by a named reviewer; presence of a file is not verification.

## Recommended owner actions

- GOV-004: Have a named reviewer verify controls.

## Limitations

- Rules evaluate owner declarations and attached evidence references; they do not verify that declarations are true.
- Risk score is an internal prioritization indicator, not a legal risk tier.
- Framework mappings are informational and are not applied automatically.
- This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety.

---
GovernSutra AI 0.2.1 · Know the system. Trace the evidence. Keep humans accountable. · created by Vatsal Shah · Apache-2.0

_This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety._
