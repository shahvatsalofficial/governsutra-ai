# Operations and Release

## Scripts
| Script | Purpose |
|---|---|
| `npm test` | Cross-platform runner over `tests/*.test.mjs` |
| `npm run doctor` | Environment check |
| `npm run demo` | Registers the synthetic fixture, assesses, scans, writes reports to `examples/reports/demo` |
| `npm run audit` | Writes `examples/audit/audit-report.{json,md,html}` |
| `npm run proof` | Regenerates `docs/proof/` (TAP log, fuzz, CLI transcripts, sealed sample audit, SHA256SUMS) |
| `npm run docs:build` | Rebuilds `documents/html` from `documents/md` and the proof files |
| `npm run pack:check` | `npm pack --dry-run` |

## Continuous integration
`.github/workflows/ci.yml`: tests, doctor, demo and audit on Ubuntu (Node 22, 24), Windows (22, 24) and macOS (24); an npm-pack smoke test through the bin shim; a committed-secret scan. `pages.yml` publishes `documents/html` to GitHub Pages. `release.yml` publishes to npm on a `vX.Y.Z` tag.

## Release checklist
1. `npm test`, `npm run proof`, `npm run audit`, `npm run docs:build` all green; commit the regenerated files.
2. Version agrees in `package.json`, `core/version.mjs`, `.claude-plugin/plugin.json`, `CITATION.cff`, `CHANGELOG.md` (a test enforces this).
3. `npm pack --dry-run`: only intended files, no secrets.
4. Tag `vX.Y.Z`, push, create a GitHub release with notes.
5. `release.yml` verifies the tag matches the version, skips if already on npm, then `npm publish --provenance --access public` using npm trusted publishing (OIDC) so no token is stored in the repository.
6. Fresh-install check: `npx governsutra-ai@X.Y.Z doctor` and `audit`.

First publish of a brand-new npm package cannot use trusted publishing yet (the package does not exist to configure). The maintainer publishes once with `npm publish --access public` (2FA), then links the GitHub repository and `release.yml` as the trusted publisher.

## Maintenance
Dependabot updates GitHub Actions weekly. Pin actions by tag or SHA. Review every new dependency before adding (the project has none).

## Backups
`.governsutra/` holds the registry, evidence index and audit log. Back it up with your normal tooling and record the `audit verify` head hash separately to make whole-file rewrites detectable.

## Incident response
Security issues: private advisory (`SECURITY.md`). If a release is faulty, `npm deprecate` the version, publish a fixed patch version, and document it in `CHANGELOG.md`.
