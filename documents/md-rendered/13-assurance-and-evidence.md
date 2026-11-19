# Assurance and Evidence

How to check what GovernSutra 0.2.1 claims, without trusting the author.

## Independent-style audit
`governsutra audit --out DIR` runs 31 checks and writes a sealed report in JSON, Markdown and HTML. The verdict `ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED` here means every executed check behaved as specified on this host. It is not an approval. Skipped checks (1) are listed, not counted as passes.

Open the [sample audit report (HTML)](samples/audit/audit-report.html), [Markdown](samples/audit/audit-report.md) or [JSON](samples/audit/audit-report.json).

## Evidence tiers
| Artifact | Tier | Proves | Does not prove |
|---|---|---|---|
| Assurance checks | executed | behavior on listed inputs, this host | other inputs or hosts |
| Hash-chained audit log | tamper-evident | accidental or partial edits detectable | authorship; whole-file rewrite by an admin |
| Evidence references | digest-only | bytes matched at recording | content is true |
| Owner declarations | declared | what was stated | accuracy |
| Scan candidates | observed | an entry exists in a file | production use; completeness |
| Risk score | heuristic | transparent weighting of declared inputs | legal risk, safety |

## Proof files
| File | Content |
|---|---|
| [test-run.tap](test-results/test-run.tap) | Raw TAP output of 80 tests |
| [fuzz-results.json](test-results/fuzz-results.json) | Seeded fuzzing counts and invariant results |
| [environment.json](test-results/environment.json) | Versions and counts |
| [SHA256SUMS.txt](test-results/SHA256SUMS.txt) | Digests of every proof file |
| [CLI transcripts](samples/) | Real command output including refusals |

Verify the digests: `sha256sum -c SHA256SUMS.txt` in the proof folder. Verify the seal: `governsutra verify --report audit-report.json`.

## Sample outputs
- `cli-assess-markdown.txt`: the Markdown assessment printed by `assess`.
- `cli-scan.txt`, `cli-import-manifests.txt`: discovery and import on the synthetic fixture.
- `cli-refusal-unknown-host.txt`, `cli-refusal-missing-id.txt`: failures are clear and non-zero.

## Not tested / not claimed
- Legal compliance, certification, regulatory classification (never performed).
- Native execution of the agents and skills in any IDE.
- Behavior on hosts other than those in the CI matrix.
- Digital signatures, key management, WORM, multi-tenant isolation, encryption at rest.
- Accuracy of owner declarations, model cards or vendor statements.
- Runtime behavior of any AI system being governed.

## How to challenge this project
Run the audit on your machine. Break a check by editing the code or an input, and confirm it fails. Open an issue with the failing command. Failures found by others are welcome and will be added as tests.
