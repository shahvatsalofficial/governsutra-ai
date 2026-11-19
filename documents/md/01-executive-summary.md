# Executive Summary

**GovernSutra AI** {{VERSION}} is an open-source (Apache-2.0), local-first command-line tool that gives organizations an inspectable register of their AI systems and checks it against ten transparent governance rules. Its promise: *Know the system. Trace the evidence. Keep humans accountable.*

## The problem
AI systems spread across repositories, vendors and teams. Owners, intended uses, model and tool versions, data sources and evidence live in scattered documents. Reviews are hard to reproduce, and compliance dashboards often show green badges that nothing supports.

## The product
- A zero-dependency Node.js CLI (`governsutra`). No API key, no account, no network, no telemetry.
- **Register:** owner, risk owner, intended and prohibited use, models, tools and MCP servers, data sources, human checkpoints, controls, exceptions, review dates.
- **Discover:** safe, bounded scan of allowlisted repository files (dependencies, lockfiles, MCP configs, CI actions, owner manifests). Output is *candidates*; an owner confirms.
- **Evaluate:** rules GOV-001..GOV-010 return `pass`, `fail`, `unknown`, `not-applicable` or `exception-approved`, each with a reason and a named owner action.
- **Trace:** SHA-256 evidence references with expiry and drift detection; a hash-chained audit log.
- **Detect change:** diff of models, tools, data, owners and intended use, with re-review triggers.
- **Report:** assessments and an independent-style audit report in **Markdown, HTML and JSON**.
- **Portable skills:** 20 agent role files, 26 `SKILL.md` skills, 8 workflows, adapters for 9 AI IDEs.

## Why you can trust the numbers
- {{TESTS}} automated tests: {{PASS}} passed, {{FAIL}} failed, {{SKIPPED}} skipped (Node {{NODE}}, {{PLATFORM}}, recorded {{RECORDED}}).
- {{AUDIT_CHECKS}} assurance checks run on hostile inputs; {{AUDIT_PASSED}} passed, {{AUDIT_SKIPPED}} skipped, {{AUDIT_FAILED}} failed.
- {{FUZZ}} fuzzed inputs; {{CRASHED}} unexpected crashes or invariant violations.
- Raw logs, transcripts and SHA-256 sums are published in `test-results/` and `samples/`.

## What it is not
Not legal advice. Not a regulatory classification. Not a certification. Not proof of safety. It never approves an exception or a release; every assessment ends in `HUMAN_REVIEW_REQUIRED`. See [Legal and governance](10-legal-and-governance).

## Who benefits
AI product owners, ML platform teams, security and privacy teams, risk owners, engineering leads and internal auditors who need to answer *what AI do we run, who owns it, what supports our claims, and what changed*.

## Decision summary
| Question | Answer |
|---|---|
| Cost | Free, Apache-2.0 |
| Data leaves the machine? | No. No network calls. |
| Needs an API key or account? | No |
| Runtime dependencies | 0 |
| Production multi-user server? | No. Dashboard, database and SSO are planned, not built |
| Replaces legal or audit review? | No |
