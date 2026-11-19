# Human checkpoint and escalation validation

**Purpose:** Test that checkpoints have named roles, time bounds, override ability, escalation and auditable intervention evidence.

## Steps
1. Confirm scope, system IDs, environment and authorized inputs.
2. Collect only allowlisted metadata and owner attestations.
3. Preserve artifact paths, versions, timestamps and hashes.
4. Evaluate relevant policy rules; represent missing evidence as `unknown`.
5. Assign every unresolved action to a human role with due date.
6. Generate a review packet and record the decision; do not auto-approve.

## Exit criteria
A named owner accepts the record, unknowns and actions; otherwise status remains `HUMAN_REVIEW_REQUIRED`.
