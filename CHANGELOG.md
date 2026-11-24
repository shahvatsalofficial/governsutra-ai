# Changelog

## 0.2.2 — 2026-11-25

### Changed
- **Documentation website rebuilt** as a real site: light theme by default with a persistent dark toggle, responsive desktop and mobile layout (drawer navigation, no horizontal overflow), landing page, sticky sidebar, on-page contents, copy buttons.
- **Visuals:** SVG flow diagrams (pipeline, rule-status decision, audit chain, CI), architecture layers, a "tool prepares / human decides" boundary figure, evidence tiers, and charts for risk weights, score sensitivity, rule statuses and proof counts. Figures follow the theme.
- **Real-world scenarios page:** seven situations (PR adds AI, auditor request, model bump, evidence drift, exception rules, audit-log edit, report edit) whose terminals are real CLI output captured at build time.
- Build prints no hand-edited numbers: every count comes from `docs/proof`. New `npm run docs:check` verifies all internal links and anchors (0 broken).
- Chart layout bug fixed (value and track columns were swapped).

## 0.2.1 — 2026-11-20

### Added
- Documentation site discovery: canonical and Open Graph tags, schema.org SoftwareApplication JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt` published with the GitHub Pages site.
- First npm release path documented and the Release workflow now publishes through npm trusted publishing (OIDC, provenance).

### Changed
- Version bump only for code: no behavior change to the CLI or core. Proof, sample audit report and docs regenerated for 0.2.1.

## 0.2.0 — 2026-11-19

First public release. Rebuilt on the 0.1.0 starter after a deep review.

### Added
- **Audit reports in Markdown, HTML and JSON**: `governsutra audit --out DIR` runs 31 hostile-input assurance checks and writes a SHA-256-sealed report; `governsutra verify --report FILE` checks the seal. Assessment reports (`assess`, `report`) also render in all three formats.
- **Rule engine** (`policy.mjs`): GOV-001..GOV-010 each return `pass`, `fail`, `unknown`, `not-applicable` or `exception-approved` with a reason and owner action. 0.1.0 reported only failures.
- **Exceptions**: valid only with a named human approver, rationale, scope, rule and future expiry; agent approvers are rejected; expired exceptions reopen the finding.
- **Control status vocabulary** enforced (`planned`, `implemented`, `evidence-attached`, `verified-by-named-reviewer`, `failed`, `unknown`, `not-applicable`, `exception-approved`).
- **Evidence expiry, named verifier and drift detection** (`evidence verify`).
- **Risk sensitivity view** (score if each factor were 1 or 5) and published missing-data behavior.
- **Repository evidence (M1)**: `package-lock.json` (v1-v3), `poetry.lock`, `uv.lock`, pinned requirements, CI workflow AI-action notes, file digests, JSON pointers and line numbers; `governance/ai-systems/*.json` manifests with optional `integrity.sha256`; `import-manifests`.
- **Change diff**: `diff` for system records and scan results, with re-review triggers.
- **Proof tooling**: `npm run proof` regenerates TAP log, deterministic fuzzing, CLI transcripts and a sealed sample audit report.
- Documentation set under `documents/` (13 documents, MD and HTML), `llms.txt`, `CITATION.cff`, legal and trust notes.
- CI: Node 22 and 24 on Ubuntu, Windows and macOS; package smoke test via the npm bin shim; secret scan; Pages and Release workflows.

### Fixed
- Windows: path containment used a hard-coded separator; the secret-path rule never matched backslash paths. Now uses `path.relative`.
- Tests resolved fixture paths with `URL.pathname` (broke on Windows) and created symlinks without handling `EPERM`.
- `install-ide` resolved assets from the current directory, so `npx` use failed outside a clone; it now uses the package root, plans all copies first (a refusal never leaves a half-install) and validates the host name.
- CLI `scan` ignored its documented `--root REPO`; options are now strict (duplicates and missing values are errors).
- Markdown report escaping no longer mangles every dot and plus sign.
- Hostile `null`, wrong-type and oversized JSON in manifests cannot crash the scanner (fuzzed).

### Changed
- Package is public as `governsutra-ai` with bins `governsutra` and `governsutra-ai`. License Apache-2.0.
- Assessment schema is `governsutra.assessment.v2` (adds rules, evidence, exceptions, unknowns, limitations, scope).

## 0.1.0 — 2026-11-17
- Initial local-first AI governance registry and CLI, transparent risk indicator, evidence hashing, hash-chained audit log, bounded repository discovery, read-only localhost API, reports, IDE adapter templates and the agent, skill, workflow and rule library.
