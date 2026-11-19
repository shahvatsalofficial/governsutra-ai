# Glossary

| Term | Meaning in GovernSutra |
|---|---|
| AI system | A product, workflow or feature that uses one or more models, tools and data to produce outputs or decisions. |
| Candidate | An item found by the scanner. Observed, not authoritative, until an owner confirms. |
| Declaration | A statement entered by an owner. Not verified by the tool. |
| Evidence reference | A SHA-256 digest and path for a file, with scope, time, optional expiry and verifier. Content is not copied. |
| Evidence drift | A file's digest differs from the recorded digest, or it is missing or expired. |
| Exception | A time-boxed, human-approved waiver of a failing rule. |
| GOV-001..010 | The ten default governance rules. |
| Hash chain | Events linked by the previous event's hash; detects edits but is not a signature. |
| HUMAN_REVIEW_REQUIRED | The only decision the tool emits; a named human decides. |
| Manifest | An owner-authored `governance/ai-systems/*.json` system record in a repository. |
| MCP | Model Context Protocol; servers that expose tools and data to AI clients. Treated as untrusted. |
| Not-applicable | A rule with no subject, with a stated reason. |
| Prioritization indicator | The 0-100 internal risk score. Not a legal category. |
| Re-review trigger | A change type that should prompt human review (model, tool, data, owner, intended use...). |
| Risk owner | The person accountable for accepting or treating the system's risk. |
| Seal | A SHA-256 over canonical JSON stored in a report. Detects change; not a signature. |
| Skill | A portable `SKILL.md` instruction file for an AI IDE; not a running service. |
| Unknown | Missing, stale or unverifiable. Never treated as pass or low risk. |
| Verified-by-named-reviewer | A control status requiring evidence and a named verifier. |
| WORM | Write once read many storage; the tool does not provide it. |
