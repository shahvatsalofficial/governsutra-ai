---
name: governsutra-affected-person-impact
description: Assess affected groups, decision impact, recourse, accessibility and potential harms.
---

# GovernSutra Skill: Affected Person Impact

## Objective
Assess affected groups, decision impact, recourse, accessibility and potential harms.

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

**Rules touched:** GOV-002, GOV-006

**Record fields and outputs:** affectedPeople; qualitative impact notes go in the human review, not in the score

**Stop conditions:** a required input is missing (report it as `unknown`, do not guess); a file looks like a secret store; the request asks you to state compliance, certify, classify legally, or approve. Hand those to a named human owner.
