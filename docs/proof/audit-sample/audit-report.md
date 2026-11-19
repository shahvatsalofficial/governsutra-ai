# GovernSutra AI — Independent Audit Report

> **Decision:** `ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED` — ASSURANCE\_CHECKS\_PASSED\_HUMAN\_REVIEW\_REQUIRED means every executed check behaved as specified. It is never an approval, certification or compliance statement. Any failed check gives ASSURANCE\_CHECKS\_FAILED. Skipped checks are listed, not counted as passes.

**Tool:** GovernSutra AI 0.2.1  
**Integrity:** SHA-256 seal verified \(3649fb91e69440c2…\)  
**Recorded:** 2026-11-19T19:01:57.211Z  
**Environment:** Node v24.15.0 · win32/x64  
**Assurance checks:** 30 passed · 0 failed · 1 skipped of 31  
**Inventory:** agents: 20 · skills: 26 · rules: 10 · workflows: 8 · hostAdapters: 9 · runtimeDependencies: 0  
**Independence statement:** Automated self-assurance: the tool exercises its own code on hostile inputs. It is not a third-party audit. A truly independent assessment needs a qualified human outside the project.  

## Assurance checks (each runs the real code on a hostile or negative-control input)

| ID | Check | Expected | Observed | Result |
|---|---|---|---|---|
| A01 | Altered audit event is detected | chain invalid | valid=false, issues=1 | pass |
| A02 | Deleted audit event breaks the chain | chain invalid | valid=false, events=1 | pass |
| A03 | Evidence path traversal is refused | error "inside the workspace" | Evidence file must be inside the workspace root | pass |
| A04 | Evidence symlink escaping the workspace is refused | error mentioning symlink | Evidence symlink resolves outside the workspace | pass |
| A05 | Secret-like evidence paths are refused \(.env, .pem\) | both refused | Secret-like paths cannot be attached as evidence; Secret-like paths cannot be attached as evidence | pass |
| A06 | Oversized evidence \(\>2 MiB\) is refused | error "exceeds 2 MiB" | Evidence file exceeds 2 MiB limit | pass |
| A07 | Scanner never reads .env values | canary string absent from output | canary leaked=false | pass |
| A08 | Credentials in dependency URLs are redacted | password absent | leaked=false | pass |
| A09 | Manifest symlinked outside the repository is skipped | zero candidates + note | host cannot create symlinks without privilege | skipped |
| A10 | Unknown risk inputs are never scored low | band not low, 6 unknown factors | score=60, band=high, unknown=6 | pass |
| A11 | Control marked verified without evidence fails GOV-004 | GOV-004 fail | fail | pass |
| A12 | File presence alone is never verification | GOV-004 not pass | unknown | pass |
| A13 | Expired exception reopens the finding | rule fails again | fail | pass |
| A14 | An agent cannot approve its own exception | exception invalid, rule still fails | fail | pass |
| A15 | Valid human exception is recorded as exception-approved, not pass | exception-approved | exception-approved | pass |
| A16 | Reports escape HTML and Markdown injection | no raw tag, link syntax escaped | htmlRawTag=false | pass |
| A17 | A fully declared system is still never auto-approved | decision HUMAN\_REVIEW\_REQUIRED | HUMAN\_REVIEW\_REQUIRED | pass |
| A18 | Report text contains no unqualified compliance claim | no "is compliant"/"certified" phrasing | claim found=false | pass |
| A19 | Local API: auth, read-only, no CORS, loopback | 401 / 405 / 403 / 127.0.0.1 | noAuth=401 POST=405 origin=403 ok=200 bind=127.0.0.1 | pass |
| A20 | Server refuses weak tokens | error | A token of at least 24 characters is required | pass |
| A21 | Manifest with wrong integrity digest is rejected | status digest-mismatch, no system | digest-mismatch | pass |
| A22 | Correct manifest digest is verified; invalid manifest is rejected | valid + invalid | \{"a.json":"valid","b.json":"invalid","c.json":"invalid-json"\} | pass |
| A23 | Manifest count is bounded \(200 max\) | 200 read + note | 200 read | pass |
| A24 | Imported manifest never overwrites an existing system | skipped, not replaced | imported=0 skipped=1 | pass |
| A25 | Lockfile yields the exact resolved version with a JSON pointer | version 4.2.1 + pointer | 4.2.1 /packages/node\_modules\~1openai | pass |
| A26 | Model version change triggers re-review | model-change-review trigger | 1 change, triggers=model-change-review | pass |
| A27 | Host adapter install refuses to overwrite without --force | refusal then success | Refusing to overwrite C:\\Users\\VATSAL\~1\\AppData\\Local\\Temp\\govsut-audit-ide-19QxFA\\.cursor\\rules\\governsutra.mdc \(+71 more\); pass --force af | pass |
| A28 | Host name path traversal is refused | Unsupported host adapter | Unsupported host adapter. See docs/IDE\_COMPATIBILITY.md | pass |
| A29 | Sealed report detects later edits | verifySeal false after edit | intact=true, afterEdit=false | pass |
| A30 | Shipped inventory matches claims \(20 agents, 26 skills, 10 rules, 8 workflows\) | counts equal | agents=20 skills=26 rules=10 workflows=8 | pass |
| A31 | Every agent and skill file states its boundaries \(no compliance claims, human authority\) | all files mention human/unknown rule | 46 files checked, 0 without boundary language | pass |

## Sample outputs

| Capability | Result |
|---|---|
| assess \(fixture AI-SYS-001\) | risk 42/100 \(moderate\); rules pass=9 fail=0 unknown=1 n/a=0; decision HUMAN\_REVIEW\_REQUIRED |
| scan \(fixtures/sample-repo\) | 4 candidates from 4 allowlisted files; notes: 1 |
| diff \(tool permission added\) | 1 change; triggers tool-permission-review |
| audit chain \(fixture workspace\) | valid=true, events=1 |

## Evidence tiers

| Artifact | Tier | Proves | Does not prove |
|---|---|---|---|
| Assurance checks \(this report\) | executed | Code behaved as specified on the listed inputs on this host and Node version. | Behaviour on other inputs, hosts or future versions. |
| Hash-chained audit.jsonl | tamper-evident | Accidental or partial edits to the event log are detectable. | Authorship, or integrity against an admin who rewrites the whole chain. |
| Evidence references \(SHA-256\) | digest-only | File bytes matched at recording time. | That the file content is true, complete or verified by a human. |
| Owner declarations in registry | declared | What an owner stated. | That the statement is accurate. |
| Repository scan candidates | observed | A declared dependency or MCP entry exists in an allowlisted file. | That it runs in production or that the inventory is complete. |
| Risk score | heuristic | A transparent weighted prioritization of declared inputs. | Legal risk category, safety or harm likelihood. |

## Not tested / not claimed

- Legal compliance, certification or regulatory classification \(never performed by this tool\).
- Native execution of the 20 agent definitions or 26 skills inside any IDE \(adapters are instruction files only\).
- macOS, Linux and Windows behaviour beyond the host named above \(see CI matrix for hosted runs\).
- Digital signatures, key management, WORM storage, multi-tenant isolation, encryption at rest \(planned, not built\).
- Accuracy of owner declarations, model cards or vendor statements.
- Runtime behaviour of any AI system being governed.

_A SHA-256 seal detects change; it is not a signature and does not prove who produced the report. Only a human maintainer can approve a release._

_This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety._

---
GovernSutra AI 0.2.1 · Know the system. Trace the evidence. Keep humans accountable. · created by Vatsal Shah · Apache-2.0

_This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety._
