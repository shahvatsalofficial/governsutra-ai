# Public Release and Naming Record

## Identity (as published)
- Product: GovernSutra AI. Chief agent: GovernSutra Prime. Creator attribution: Vatsal Shah.
- GitHub repository: `shahvatsalofficial/governsutra-ai`
- npm package: `governsutra-ai` (unscoped, like the other Sutra tools; availability checked with `npm view` on 2026-11-19, it returned 404 before first publish). The scoped name `@vatsalshah/governsutra-ai` from the original prompt was not used because no `@vatsalshah` npm scope is confirmed.
- CLI binaries: `governsutra`, `governsutra-ai`
- Tagline: Know the system. Trace the evidence. Keep humans accountable.

## Pre-publication checklist and status
| Item | Status |
|---|---|
| Name search on GitHub/npm | npm checked; a search for confusingly similar names and trademarks is the maintainer's call and is **not** done |
| Apache-2.0 license, NOTICE, third-party notices | done |
| No local `.governsutra` workspaces or credentials in the package | `files` whitelist in `package.json`; `npm run pack:check`; CI secret scan |
| Tests on Linux, macOS, Windows | CI matrix (see Actions tab) |
| SBOM | not needed: zero dependencies (`npm ls --all`) |
| Provenance | `npm publish --provenance` from `release.yml` (trusted publishing) |
| Signed release | planned (roadmap); SHA-256 sums for proof files only |
| Framework mappings labelled informational | done |

## First publish
A new npm package must be published once by the maintainer (`npm publish --access public`, with 2FA). Afterwards link `shahvatsalofficial/governsutra-ai` and `release.yml` as the trusted publisher in the npm package settings so later releases need no token.
