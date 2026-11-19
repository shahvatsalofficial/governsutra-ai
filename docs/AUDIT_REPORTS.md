# Audit and Assessment Reports

GovernSutra writes every report in **three formats from one source**: JSON (machine), Markdown (review and diff), HTML (read and share). The renderers use the same block list, so formats cannot disagree.

## Commands
```bash
governsutra assess --id ID --format md          # print one format
governsutra report --id ID --out DIR             # assessment.json, assessment.md, assessment.html
governsutra audit  --out DIR [--force]           # audit-report.json, audit-report.md, audit-report.html
governsutra verify --report DIR/audit-report.json
governsutra diff --a before.json --b after.json --format html
```
`audit` refuses to overwrite existing files unless `--force` is passed.

## Assessment report (`governsutra.assessment.v2`)
System boundary and review scope, data cutoff, record provenance, risk indicator with factors, assumptions and a sensitivity table, all ten rules with status and reason, models, tools and data sources, control status, evidence references with digests and expiry, exceptions, unknowns, recommended owner actions, limitations and disclaimer. Decision is always `HUMAN_REVIEW_REQUIRED`.

## Audit report (`governsutra.audit.v1`)
Runs real code on hostile or negative-control inputs: audit tampering, path traversal, symlinks, secret paths, oversized files, `.env` canaries, URL credentials, unknown-is-not-low, verified-without-evidence, expired and agent-approved exceptions, report injection, API authentication and write attempts, manifest digest mismatch and bounds, overwrite protection, seal tampering and inventory counts.

Verdicts:
- `ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED` — every executed check behaved as specified. Never an approval or certification.
- `ASSURANCE_CHECKS_FAILED` — at least one check failed; exit code 2.
- Skipped checks (for example symlink creation without privilege on Windows) are listed and never counted as passes.

The report also lists evidence tiers (what each artifact proves and does not prove), sample outputs, "not tested / not claimed", and is sealed with a SHA-256 over canonical JSON. A seal detects edits; it is not a signature.

## Independence
The audit is **automated self-assurance**: the tool tests its own code. A real independent audit needs a qualified human outside the project. The report states this in its `independence` field.
