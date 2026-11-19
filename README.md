# GovernSutra AI

**Know the system. Trace the evidence. Keep humans accountable.**

[![CI](https://github.com/shahvatsalofficial/governsutra-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shahvatsalofficial/governsutra-ai/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/governsutra-ai)](https://www.npmjs.com/package/governsutra-ai)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![Node >=22](https://img.shields.io/badge/node-%3E%3D22-informational)

GovernSutra AI is an open-source, **local-first AI system governance CLI**. It keeps an inspectable register of your AI systems (intended use, owners, models, tools, MCP servers, data sources, human checkpoints, controls), links each record to real repository artifacts, evaluates ten transparent governance rules, and produces **audit reports in Markdown, HTML and JSON**. No API key, no cloud, no telemetry, zero runtime dependencies.

Documentation: **<https://shahvatsalofficial.github.io/governsutra-ai/>** · Full docs set: [`documents/`](documents/README.md) · Proof: [`docs/proof/`](docs/proof/README.md) · Created by [Vatsal Shah](https://github.com/shahvatsalofficial)

> **What this is not.** GovernSutra is an engineering review aid. It gives no legal advice, assigns no regulatory category (for example under the EU AI Act), certifies nothing (ISO/IEC 42001, NIST AI RMF and others are *not* "met" by running it), and cannot prove an AI system is safe. Missing or stale evidence is reported as **UNKNOWN**, never as a pass. A named human owner makes every decision. See [Legal and trust](docs/LEGAL_AND_TRUST.md).

## Who it is for

AI product owners, ML platform maintainers, security and privacy teams, risk owners, engineering leads and internal auditors who need to answer: *which AI systems do we have, who owns them, what models, tools and data do they use, what evidence supports our claims, and what changed since the last review?*

## Quick start

```bash
npx governsutra-ai doctor
npx governsutra-ai audit --out ./governsutra-audit      # self-check report: .json .md .html
```

```bash
npm install -g governsutra-ai                           # optional; installs `governsutra` and `governsutra-ai`
governsutra init
governsutra register --input my-system.json
governsutra assess --id MY-SYSTEM-1 --format md
governsutra report --id MY-SYSTEM-1 --out ./reports/my-system-1
```

From a clone: `npm test`, `npm run doctor`, `npm run demo`, `npm run audit`.

## What you get

| Capability | Command | Output |
|---|---|---|
| AI system register with owner, risk owner, intended and prohibited use | `register`, `list` | `.governsutra/registry.json` |
| Ten rules GOV-001..GOV-010, each `pass`, `fail`, `unknown`, `not-applicable` or `exception-approved` with a reason | `assess` | JSON, Markdown, HTML |
| Transparent six-factor risk indicator with sensitivity view | `assess` | score, band, per-factor "if 1 / if 5" |
| Safe repository discovery: `package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`, `poetry.lock`, `uv.lock`, MCP configs, CI workflows, `governance/ai-systems/*.json` | `scan`, `import-manifests` | candidates with JSON pointer, line and file digest |
| Change diff for model, tool, data, prompt, owner and intended-use changes, with re-review triggers | `diff` | JSON, Markdown, HTML |
| Evidence references (SHA-256, expiry, named verifier) with drift detection | `evidence add`, `evidence verify` | `.governsutra/evidence/index.json` |
| Hash-chained audit log | `audit verify` | chain status and head hash |
| Independent-style assurance report: 31 hostile-input checks, sealed with SHA-256 | `audit --out DIR` | `audit-report.json`, `.md`, `.html` |
| 20 agent role definitions, 26 portable `SKILL.md` skills, 8 workflows, 9 IDE adapters | `install-ide` | project-local files |
| Read-only loopback API with bearer token | `serve` | JSON over `127.0.0.1` |

## Sample output

Real files, produced by this repository's code:

- Assessment report: [`examples/reports/demo/assessment.md`](examples/reports/demo/assessment.md) · [`.html`](examples/reports/demo/assessment.html)
- Independent-style audit report: [`examples/audit/audit-report.md`](examples/audit/audit-report.md) · [`.html`](examples/audit/audit-report.html)
- Raw TAP test log, fuzz results and CLI transcripts: [`docs/proof/`](docs/proof/README.md)

A system record is plain JSON ([`fixtures/sample-system.json`](fixtures/sample-system.json), [schema](schemas/system.schema.json)). Repositories can carry owner-authored manifests in `governance/ai-systems/*.json`, optionally with an `integrity.sha256` digest ([format](docs/DATA_MODEL.md)).

## Safety model (what the code actually enforces)

- **Offline.** No network calls. The optional API binds `127.0.0.1` only, requires a 24+ character bearer token, rejects every non-GET method and any request with an `Origin` header.
- **Untrusted input.** Repository files, manifests, model cards and tool descriptions are data. Allowlisted file names only, 2 MiB cap, symlinks and paths outside the root are skipped, 200-manifest cap.
- **No secrets.** `.env` files are never read (the scan only notes they exist). URL credentials in dependency strings are redacted. `.pem`, `.key`, `.ssh`, `.aws` and the governance workspace itself cannot be attached as evidence.
- **Unknown stays unknown.** Missing risk inputs score mid-scale (never low) and are listed. A control marked verified without hashed evidence and a named verifier fails GOV-004. Expired evidence turns to unknown. File presence is never verification.
- **Humans decide.** Every assessment ends in `HUMAN_REVIEW_REQUIRED`. An exception counts only with a named human approver, rationale, scope and a future expiry. An agent approver is rejected. Expired exceptions reopen the finding.
- **Tamper evidence, honestly labelled.** The audit log and reports use SHA-256 chains and seals. They detect edits; they are **not** digital signatures or WORM storage.

Read the [threat model](docs/THREAT_MODEL.md), the [evidence model](docs/EVIDENCE_MODEL.md) and [`SECURITY.md`](SECURITY.md).

## Evidence you can check yourself

Trust, but verify. Everything below is reproducible on your machine:

```bash
npm test                                   # 78 tests (unit, integration, security, CLI end to end)
npm run proof                              # regenerates docs/proof/: TAP log, fuzzing, CLI transcripts, sealed audit report
node packages/cli/index.mjs audit --out out --force
node packages/cli/index.mjs verify --report out/audit-report.json
```

Latest recorded run: see [`docs/proof/environment.json`](docs/proof/environment.json) and the [test report](documents/md/08-test-report.md). The audit report lists what was **not** tested, including native execution inside every IDE, signatures, multi-tenant isolation and every legal question.

## Agents, skills and IDE adapters

The 20 agents and 26 skills are **portable instruction files**, not running services. Adapters for Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf, Cline, Roo Code and Continue copy those instructions into a project (refusing to overwrite without `--force`). Native activation in each host is **not verified**; unsupported hosts can use the CLI and the Markdown/JSON contracts. See [IDE compatibility](docs/IDE_COMPATIBILITY.md), the [agent catalog](docs/AGENT_CATALOG.md) and the [skill catalog](docs/SKILL_CATALOG.md).

```bash
governsutra install-ide --host claude --target ./my-project --dry-run
governsutra install-ide --host claude --target ./my-project
```

## Frameworks

Mapping packs for NIST AI RMF, ISO/IEC 42001, OECD AI Principles and the EU AI Act are **informational evidence-organization aids** that need qualified review ([docs](docs/FRAMEWORK_MAPPINGS.md)). The tool never decides whether a law applies or whether you comply. ISO/IEC 42001 clause text is copyrighted and is not reproduced.

## Status and roadmap

Implemented and tested: registry, rules, risk indicator, scanner, lockfile parsing, manifests, diff, evidence, audit chain, reports, assurance audit, API, installer. Planned, **not built**: dashboard, database storage, SSO/RBAC, signed attestations, MCP server, YAML manifests. See [STATUS](docs/STATUS.md) and [ROADMAP](ROADMAP.md).

## Documentation

[Executive summary](documents/md/01-executive-summary.md) · [Functional spec](documents/md/02-functional-specification.md) · [Architecture](documents/md/03-architecture.md) · [Technical reference](documents/md/04-technical-reference.md) · [User guide](documents/md/05-user-guide.md) · [Security](documents/md/06-security-and-privacy.md) · [Evidence and rules](documents/md/07-evidence-model-and-rules.md) · [Test report](documents/md/08-test-report.md) · [Operations](documents/md/09-operations-and-release.md) · [Legal](documents/md/10-legal-and-governance.md) · [Roadmap and FAQ](documents/md/11-roadmap-and-faq.md) · [Glossary](documents/md/12-glossary.md) · [Assurance](documents/md/13-assurance-and-evidence.md)

## Contributing, security, license

[CONTRIBUTING](CONTRIBUTING.md) · [SECURITY](SECURITY.md) · [SUPPORT](SUPPORT.md) · [GOVERNANCE](GOVERNANCE.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) · Licensed under [Apache-2.0](LICENSE) · [NOTICE](NOTICE) · [Third-party notices](THIRD_PARTY_NOTICES.md). Cite with [`CITATION.cff`](CITATION.cff).

GovernSutra AI is an independent project by Vatsal Shah. It is not affiliated with, or endorsed by, NIST, ISO/IEC, the OECD, the European Union or any regulator, model provider or IDE vendor. Product and standard names are used only to describe compatibility and informational mapping.
