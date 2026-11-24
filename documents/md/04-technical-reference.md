# Technical Reference

## Requirements and install
Node.js 22 or newer. No runtime or dev dependencies.
```bash
npx governsutra-ai doctor
npm install -g governsutra-ai     # bins: governsutra, governsutra-ai
```

## CLI
```
governsutra init | register | import-manifests | list | assess | report
governsutra evidence add|verify | scan | diff | audit [verify] | verify
governsutra install-ide | serve | doctor | version | help
Global options: --root DIR (default .)  --actor NAME
```
Options are strict: unknown commands, duplicate options and missing values are errors. Exit codes: `0` ok, `1` error, `2` a check, drift or tamper finding.

## Library
```js
import { ensureWorkspace, registerSystem, assessSystem, scanRepository, diffSystems } from 'governsutra-ai/packages/core/index.mjs';
```
| Function | Returns |
|---|---|
| `validateSystem(s)` | array of error strings (empty = valid) |
| `evaluateRules(s, evidence, at)` | `{rules, exceptions, evaluatedAt}` |
| `computeRisk(s)` | `{score, band, factors, sensitivity, unknownFactors, missingDataBehavior}` |
| `assessSystem(root, id)` | `governsutra.assessment.v2` |
| `scanRepository(dir)` | candidates, `sourceDigests`, manifests, notes, limitations |
| `loadManifests(dir)` / `importManifests(root, dir)` | manifests and import summary |
| `diffSystems(a, b)` / `diffScans(a, b)` | changes and re-review triggers |
| `addEvidence` / `verifyEvidence` | evidence record / drift list |
| `verifyAudit(root)` | `{valid, eventCount, headHash, issues}` |
| `runAudit()` | sealed `governsutra.audit.v1` report |
| `seal` / `verifySeal` | canonical SHA-256 seal |

## Risk model `risk-model/1.0`

<!--@@bars:weights@@-->

<!--@@bars:sensitivity@@-->

Score = round(sum(value/5 x weight)). Weights: decision impact 25, autonomy 20, data sensitivity 20, deployment exposure 15, model transparency gap 10, human oversight gap 10. Values 1-5 (maps: autonomy none 1, assist 2, partial 4, automated 5; sensitivity public 1 ... sensitive 5; exposure internal 1, external 5; oversight documented 1, partial 3, unknown 5). Unknown inputs use 3 and are listed. Bands: under 25 low, under 50 moderate, under 75 high, else critical. **Internal prioritization only.**

## Scanner allowlist
`package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `mcp.json`, `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.github/workflows/*.yml`, `governance/ai-systems/*.json`. Candidate fields: `type`, `name`, `version`, `source`, `pointer`, `line`, `sourceSha256`, `confidence`, `metadata`.

## Audit chain
Each event: `{seq, timestamp, actor, action, entityId, details, prevHash, hash}`, hash = SHA-256 of the JSON of the other fields. `GENESIS` seeds the chain. Detects edits, deletions, reordering. Not a signature.

## Local API
`GET /health`, `/systems`, `/systems/{id}` (assessment), `/audit/verify`. Needs `Authorization: Bearer <GOVSUTRA_TOKEN>` (24+ characters). Non-GET gives 405; an `Origin` header gives 403; non-loopback peers 403; 120 requests per minute.

## Reports
`governsutra.assessment.v2`, `governsutra.audit.v1`, `governsutra.diff.v1`. Schemas for records in `schemas/`.
