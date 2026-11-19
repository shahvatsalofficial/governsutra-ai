# Test Report

Recorded by `npm run proof` on **2026-11-19T18:07:31.639Z**, Node **v24.15.0**, **win32/x64**, GovernSutra **0.2.0**. Raw output is in [test-results/test-run.tap](test-results/test-run.tap); nothing here is hand-edited.

## Summary
| Suite | Result |
|---|---|
| Automated tests (`node --test`) | 80 total, **80 passed**, 0 failed, 0 skipped |
| Assurance audit (`governsutra audit`) | 31 checks: 30 passed, 1 skipped, 0 failed; verdict `ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED` |
| Fuzzing (deterministic seed) | 3500 generated inputs; 0 unexpected exceptions or invariant violations |

## What the tests cover
- **Normal:** registration, listing, assessment, reports in three formats, evidence, scan, import, diff, CLI end to end.
- **Boundary:** 2 MiB limits, 200-manifest cap, empty and minimal systems, expired evidence and exceptions.
- **Malicious:** path traversal, symlink escape, `.env` canary, URL credentials, HTML and Markdown injection, tampered manifests, tampered audit log, agent-approved exceptions, API writes and cross-origin requests, adapter overwrite and host traversal.
- **Negative controls:** unknown is not pass; verified without evidence fails; file presence is not verification; expired exception reopens.
- **Consistency:** package, plugin manifest, citation and changelog versions agree.

## Fuzzing
Three phases, all from a fixed seed so results repeat: random mutations of a valid record through validation, rules and risk (invariants: statuses legal, score 0-100, unknown never low); hostile manifest sets through the scanner; injection strings through both renderers. See [fuzz-results.json](test-results/fuzz-results.json).

A note on honesty: an earlier fuzz run reported 13 "scanner failures". They were a bug in the fuzz harness (it wrote `undefined` to disk), not in the scanner. A 1,000-combination brute-force of hostile manifest values then showed 0 throws. The harness was fixed rather than the result ignored.

## Real defects found and fixed during the 0.2.0 review
1. Path containment used a hard-coded `/`, so Windows paths mis-evaluated; the secret-path regex never matched `\` paths.
2. Tests resolved fixtures with `URL.pathname` (invalid on Windows) and created symlinks without handling `EPERM`; four tests failed on Windows.
3. `install-ide` read assets from the working directory, so `npx` use outside a clone failed; the CLI `scan` ignored its documented `--root`.
4. Markdown escaping mangled dots and plus signs.
5. Reports listed only failures, hiding which rules passed; unknown and not-applicable were not first-class.

## CI matrix
Node 22 and 24 on Ubuntu, Windows and macOS, plus an npm-pack smoke test that installs the tarball into an empty project and runs the CLI through the bin shim. Results: the repository Actions tab. Hosted-runner results are not part of the local proof above.

## Not tested
See [Assurance and evidence](13-assurance-and-evidence): native IDE execution, signatures, multi-tenant, legal questions.

## Reproduce
```bash
git clone https://github.com/shahvatsalofficial/governsutra-ai && cd governsutra-ai
npm test && npm run proof && npm run audit
```
