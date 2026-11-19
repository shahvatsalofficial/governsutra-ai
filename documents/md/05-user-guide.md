# User Guide

A walk-through from zero to a reviewed AI system. All commands run offline.

## 1. Check your machine
```bash
npx governsutra-ai doctor
```
Expect `nodeSupported: true` and `runtimeDependencies: 0`.

## 2. Create a workspace
```bash
governsutra init
```
This creates `.governsutra/` (registry, policies, evidence index, audit log). Add `.governsutra/` to `.gitignore` if it holds anything sensitive; it normally holds metadata only.

## 3. Describe an AI system
Create `my-system.json` (start from `fixtures/sample-system.json`). Required: `id`, `name`, `intendedUse`, `owner`, `riskOwner`, and arrays `models`, `tools`, `dataSources`, `humanCheckpoints`, `prohibitedUses` (use `[]` to declare none). Unknown values should be written as unknown, not guessed.
```bash
governsutra register --input my-system.json
```

## 4. Assess
```bash
governsutra assess --id MY-SYSTEM-1 --format md
```
Read the rules table first. `fail` means a declared gap. `unknown` means no evidence either way. `not-applicable` is explained. The decision line always says `HUMAN_REVIEW_REQUIRED`.

## 5. Attach evidence
```bash
governsutra evidence add --id MY-SYSTEM-1 --file docs/model-card.md --kind model-card --expires 2027-06-30 --verifier "Jane Reviewer"
governsutra evidence verify
```
Only a hash is stored. If the file changes, goes missing or expires, `evidence verify` reports it and exits 2. Then list the evidence ID under a control with status `verified-by-named-reviewer` and a `verifier` to satisfy GOV-004.

## 6. Discover candidates in a repository
```bash
governsutra scan --repo ../my-app
```
Open `.governsutra/scans/latest.json`. These are observed candidates, not an inventory. Confirm with the owner, then register a system or commit an owner manifest.

## 7. Keep manifests in the repository
Put `governance/ai-systems/my-system.json` in the repo (optionally with `integrity.sha256`). Then:
```bash
governsutra import-manifests --repo ../my-app
```

## 8. Detect change
```bash
governsutra diff --a last-quarter.json --b today.json --format html > change.html
```
Triggers such as `model-change-review` or `tool-permission-review` tell a human what to re-review.

## 9. Record an exception (human only)
Add to the system record:
```json
"exceptions": [{"id":"EX-1","ruleId":"GOV-006","rationale":"Pilot, reviewed daily","scope":"staging only",
  "approver":{"name":"Jane Doe","type":"human"},"expiresAt":"2027-01-31"}]
```
The rule shows `exception-approved` until expiry, then fails again.

## 10. Produce reports
```bash
governsutra report --id MY-SYSTEM-1 --out ./reports/my-system-1
governsutra audit --out ./audit --force
governsutra verify --report ./audit/audit-report.json
```
You get JSON, Markdown and HTML for each.

## 11. Use with an AI IDE
```bash
governsutra install-ide --host cursor --target . --dry-run
governsutra install-ide --host cursor --target .
```
Existing files are never overwritten without `--force`. Native behavior depends on the IDE and version.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `Invalid system: ... must be an array` | Declare `[]` for none. |
| `System already exists` | IDs are unique; use `diff` to review a changed record. |
| `Refusing to overwrite` | Review the target, then pass `--force`. |
| `Secret-like paths cannot be attached` | Attach documentation about the secret store, not the secret. |
| `serve` asks for a token | `GOVSUTRA_TOKEN` must be 24+ random characters. |
| Symlink checks skipped on Windows | Windows needs privilege to create file symlinks; the check is reported as skipped, not passed. |
