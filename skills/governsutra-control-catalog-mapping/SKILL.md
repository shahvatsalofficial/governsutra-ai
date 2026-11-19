---
name: governsutra-control-catalog-mapping
description: Map system-specific controls to internal control catalogues without claiming external certification.
---

# GovernSutra Skill: Control Catalog Mapping

## Objective
Map system-specific controls to internal control catalogues without claiming external certification.

## Procedure
1. Confirm system, repository and review scope with the user or named owner.
2. Use the smallest allowlisted evidence set needed.
3. Do not read secrets, `.env` values, raw personal data or private prompts.
4. Distinguish observed facts, owner declarations, inferred candidates and unknowns.
5. Record provenance and integrity references for every material claim.
6. Return findings with status, severity, confidence, limitations and named owner action.
7. Route legal interpretation, risk acceptance and production decisions to qualified humans.

## Output
A concise, machine-readable result with `scope`, `findings`, `evidence`, `unknowns`, `limitations` and `recommendedNextActions`.

## Tool support (GovernSutra CLI)

**Use when** the task matches the objective above and you have an authorized repository or workspace. **Skip when** the question is legal interpretation, a regulatory category, or a release or exception decision: route those to named humans.

**Commands (offline, no network):**
- `governsutra assess --id ID`

**Rules touched:** GOV-004

**Record fields and outputs:** controls[].id, status, evidenceIds, verifier (status vocabulary is enforced)

**Stop conditions:** a required input is missing (report it as `unknown`, do not guess); a file looks like a secret store; the request asks you to state compliance, certify, classify legally, or approve. Hand those to a named human owner.
