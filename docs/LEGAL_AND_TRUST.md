# Legal and Trust

This page explains what GovernSutra AI claims, what it does not, and how to check. It is not legal advice.

## What GovernSutra AI is
A local engineering tool that organizes declarations and evidence references about AI systems and checks them against ten deterministic rules. Output is a review aid for qualified humans.

## What it never does
- Declare legal compliance, certification, conformity, or audit assurance.
- Assign statutory categories (for example EU AI Act risk tiers) or decide whether any law applies.
- Replace legal, privacy, security, safety or domain review.
- Approve an exception, a release or a risk acceptance. Every assessment ends in `HUMAN_REVIEW_REQUIRED`.
- Treat missing, stale or contradictory evidence as a pass. It is `UNKNOWN`.

The risk score is an internal prioritization indicator, not a legal risk tier.

## Standards and names
NIST AI RMF, ISO/IEC 42001, OECD AI Principles and the EU AI Act are referenced for informational organization of evidence only. Running this tool does not mean you meet any of them. ISO/IEC 42001 text is copyrighted and is not reproduced. Product, standard and vendor names belong to their owners; no affiliation or endorsement is implied.

## Licensing
Code and documents: Apache License 2.0 ([LICENSE](../LICENSE), [NOTICE](../NOTICE)). Zero runtime and zero development dependencies, so there is no transitive license exposure ([THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md)). Fixtures are synthetic.

## Privacy
No network calls, no telemetry, no account. The tool stores metadata and SHA-256 digests, not file content. It refuses `.env`, key files and its own workspace as evidence and never reads `.env` values. Keep personal data and secrets out of records; the tool cannot recognise every secret. If you register real people or customers in a record, that is your data-protection responsibility.

## How to verify these claims
1. `npm test` — behavior tests incl. negative and hostile cases.
2. `governsutra audit --out DIR` — 31 checks; read the "Not tested / not claimed" section.
3. `npm run proof` — raw TAP log, fuzz results, CLI transcripts, SHA256SUMS.
4. Read the source: about 1,000 lines, no dependencies, `packages/core`.

## Honest limits
Hash chains and seals detect edits only; they are not signatures. The assurance audit is automated self-checking, not a third-party audit. Native IDE agent execution is not verified. For regulated or high-impact AI, involve qualified reviewers; this tool helps you bring organized evidence to them.
