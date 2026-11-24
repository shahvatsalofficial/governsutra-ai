# Real-World Scenarios

Seven situations that happen in real teams, with the **actual output** of GovernSutra {{VERSION}}. The terminals below were produced by running the CLI against the bundled synthetic fixtures when this site was built. Nothing is mocked and no real company, person or model is involved.

Each scenario has the same shape: what happened, what the tool shows, what it does **not** claim, and what a human does next.

<!--@@diagram:pipeline@@-->

## 1. A pull request quietly adds AI

**Situation.** A backend developer opens a PR that adds an LLM SDK and an MCP server to a support tool. Nobody told the governance lead. The team wants to find out *before* merge, not at the next quarterly review.

**What the tool does.** `scan` reads only allowlisted files (`package.json`, lockfiles, MCP configs, CI workflows, owner manifests). It never opens `.env`. Every candidate carries the file, a JSON pointer and a digest.

<!--@@term:s1@@-->

**What it does not claim.** These are *candidates*, observed in files. They do not prove the SDK runs in production, and the list is not a complete inventory.

**What a human does next.** The system owner confirms or rejects each candidate, then registers the system (or commits a `governance/ai-systems/*.json` manifest). Until then it stays an unconfirmed candidate.

## 2. An auditor asks "show me the evidence"

**Situation.** Internal audit asks for the current governance position of the support assistant. Last time this took two weeks of screenshots and spreadsheets.

**What the tool does.** `assess` evaluates ten rules. Each returns `pass`, `fail`, `unknown`, `not-applicable` or `exception-approved`, with a reason.

<!--@@term:s2@@-->

Notice what is *not* there: a green badge. The one `unknown` (GOV-004) says no control is verified by a named reviewer, because a control that is only `implemented` has not been checked by anybody.

<!--@@rules@@-->

<!--@@bars:ruleStatus@@-->

**What a human does next.** A named reviewer verifies the control, attaches hashed evidence, and the rule can become `pass`. Share the HTML report instead of screenshots.

## 3. A model version is bumped

**Situation.** The platform team moves the assistant to a newer model release and gives a tool an extra permission, in the same sprint.

**What the tool does.** `diff` compares the last approved record with today's and names the **re-review triggers**.

<!--@@term:s3@@-->

**What it does not claim.** It does not say the change is safe or unsafe. It says a human should look, and why.

**What a human does next.** The risk owner decides whether the change is material, re-runs `assess`, and records the decision. In CI you can run `diff` on every PR and block merge until a person acknowledges the triggers.

<!--@@diagram:ci@@-->

## 4. Evidence changes after sign-off

**Situation.** A reviewer signed off a model card in March. In June someone edits the file, removing the "known limitations" section. The sign-off still points at the same path.

**What the tool does.** Evidence is stored as a path plus a SHA-256 digest. `evidence verify` re-hashes the file and reports drift, missing files and expiry, exiting `2` so a CI job fails.

<!--@@term:s4@@-->

**What it does not claim.** The digest proves *bytes changed*. It cannot say whether the new text is better or worse, or who changed it.

**What a human does next.** Re-review the document, record fresh evidence, and let the old sign-off expire. Expired or drifted evidence turns the related rule to `unknown`, never `pass`.

<!--@@html:tiers@@-->

## 5. A pilot needs an exception

**Situation.** A pilot launches before the human review step is built. The support lead asks for a time-boxed waiver. A well-meaning engineer suggests letting the governance agent approve it to save time.

**What the tool does.** An exception counts only with a named **human** approver, a rationale, a scope and a future expiry. An agent approver is invalid. After expiry the rule fails again and says so.

<!--@@term:s5@@-->

**What a human does next.** Priya's exception is honored until its date. The other two fail with reasons, so nobody discovers an invalid waiver during an audit.

<!--@@diagram:decision@@-->

## 6. Someone edits the audit log

**Situation.** During an incident review, someone "tidies" one entry in the audit log to make a timeline look cleaner.

**What the tool does.** Every audit event carries the hash of the previous event. Changing one entry breaks the chain from that line onward.

<!--@@term:s6@@-->

<!--@@diagram:chain@@-->

**What it does not claim.** A hash chain is not a signature. An administrator who rewrites the whole file can recompute every hash. Store the head hash somewhere separate, or add signing, if that matters to you.

## 7. Someone edits the audit report

**Situation.** An audit report says some checks were skipped. Before it goes to the steering committee, the verdict is changed to "APPROVED".

**What the tool does.** Reports carry a SHA-256 seal over canonical JSON. `verify` recomputes it.

<!--@@term:s7@@-->

**What it does not claim.** The seal detects edits. It does not prove who produced the original report, and the audit itself is automated self-checking, not a third-party audit.

## Why these scenarios matter

| Scenario | The failure it prevents |
|---|---|
| 1 | Shadow AI: systems nobody registered |
| 2 | Dashboard theatre: green badges with no evidence behind them |
| 3 | Silent change: a model or permission moves without review |
| 4 | Stale sign-off: evidence drifts after approval |
| 5 | Self-approval: an agent or script waives its own gate |
| 6 | History editing: the record is quietly rewritten |
| 7 | Report editing: the verdict is quietly rewritten |

Run them yourself: every command above works offline with `npx governsutra-ai`. See the [user guide](05-user-guide) for setup and the [evidence model](07-evidence-model-and-rules) for the rules behind each result.
