# Evidence Model and Rules

## Evidence tiers

<!--@@html:tiers@@-->
Not all evidence is equal. Reports label each tier.
| Tier | Example | Proves | Does not prove |
|---|---|---|---|
| declared | owner states "human review before send" | what the owner said | that it is true |
| observed | `openai` found in `package-lock.json` | an entry exists in a file | it runs in production |
| digest-only | SHA-256 of a model card | bytes at recording time | content is correct or complete |
| executed | an assurance check ran | behavior on that input and host | other inputs |
| verified-by-named-reviewer | a named person reviewed evidence | that reviewer's judgment | anything about the reviewer's competence |

## Evidence record
`id`, `systemId`, `kind`, `relativePath`, `sha256`, `sizeBytes`, `scope`, `recordedAt`, `expiresAt`, `verifier`, `limitations`, `status = reference-hashed-not-content-validated`. File content is not copied.

## Rule evaluation

<!--@@diagram:decision@@-->

<!--@@rules@@-->

Each rule returns exactly one status with a reason:
- **pass** - the specific requirement is met by declaration or evidence (always labelled declared or verified).
- **fail** - a requirement is explicitly unmet.
- **unknown** - evidence is missing, stale, expired or unverifiable. **Never promoted to pass.**
- **not-applicable** - the rule has no subject (for example GOV-009 with no tools) and says why.
- **exception-approved** - a failing rule covered by a valid human exception.

Example: a control `verified-by-named-reviewer` with an evidence ID that does not exist in the index fails GOV-004. The same control with an evidence item whose `expiresAt` is past yields `unknown`.

## Exceptions
| Field | Requirement |
|---|---|
| `ruleId` | the rule being excepted |
| `approver` | `{name, type: "human"}`; any other type is invalid |
| `rationale`, `scope` | non-empty |
| `expiresAt` | valid ISO date in the future |
After expiry the finding is reopened and the reason says so.

## Verifying evidence later
`evidence verify` re-hashes each file: `ok`, `digest-changed`, `missing`, `expired`, `unsafe-path`.

## Audit chain

<!--@@diagram:chain@@-->
Sequential events chained by `prevHash`. `audit verify` reports issues by line: `invalid JSON`, `sequence mismatch`, `previous hash mismatch`, `event hash mismatch`. Not a signature or WORM storage.

## Seals
Audit reports carry `evidence.sha256` over canonical (sorted-key) JSON. `verify --report` recomputes it.
