# Control evidence refresh and expiry

**Purpose:** Find stale or missing evidence, request renewal, verify hashes and provenance, record reviewer attestation and expiry.

## Steps
1. Confirm scope, system IDs, environment and authorized inputs.
2. Collect only allowlisted metadata and owner attestations.
3. Preserve artifact paths, versions, timestamps and hashes.
4. Evaluate relevant policy rules; represent missing evidence as `unknown`.
5. Assign every unresolved action to a human role with due date.
6. Generate a review packet and record the decision; do not auto-approve.

## Exit criteria
A named owner accepts the record, unknowns and actions; otherwise status remains `HUMAN_REVIEW_REQUIRED`.
