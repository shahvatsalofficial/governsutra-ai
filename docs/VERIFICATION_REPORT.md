# Verification Report

Superseded as a hand-written document. Verification evidence is now **machine-generated** so nobody has to trust prose.

| Evidence | Where |
|---|---|
| Raw TAP output of the full test suite | [`docs/proof/test-run.tap`](proof/test-run.tap) |
| Versions, counts, audit verdict | [`docs/proof/environment.json`](proof/environment.json) |
| Seeded fuzzing results | [`docs/proof/fuzz-results.json`](proof/fuzz-results.json) |
| Real CLI transcripts, including refusals | `docs/proof/cli-*.txt` |
| Sealed sample audit report (JSON, Markdown, HTML) | [`docs/proof/audit-sample/`](proof/audit-sample/) |
| SHA-256 of every proof file | [`docs/proof/SHA256SUMS.txt`](proof/SHA256SUMS.txt) |
| Rendered test report | [`documents/md/08-test-report.md`](../documents/md/08-test-report.md) |

Regenerate: `npm run proof`. Verify the seal: `governsutra verify --report docs/proof/audit-sample/audit-report.json`.

## Review history
- 0.1.0 (2026-11-17): Linux/Node 22 only; 37 tests. Windows and macOS not run.
- 0.2.0 (2026-11-19): deep review on Windows/Node 24 found four failing tests and several defects (see CHANGELOG and the test report), all fixed; test count now recorded in `environment.json`. Hosted CI (Ubuntu, Windows, macOS; Node 22 and 24) results live in the repository Actions tab.

## Limitations
Proof shows behavior on the recorded host and inputs only. It does not prove legal compliance, safety, native IDE execution, or behavior of any governed AI system. No third-party audit has been performed.
