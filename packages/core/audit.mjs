import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PKG_ROOT, installHost } from './install.mjs';
import { ensureWorkspace, registerSystem, assessSystem, addEvidence, verifyAudit, scanRepository, loadManifests, computeRisk, evaluateRules, renderMarkdownReport, renderHtmlReport, diffSystems, importManifests } from './index.mjs';
import { seal, verifySeal, now, canonical, sha256 } from './util.mjs';
import { VERSION } from './version.mjs';
import { createGovernanceServer } from '../server/index.mjs';

const sample = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'fixtures', 'sample-system.json'), 'utf8'));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), `govsut-audit-${p}-`));
const sys = (id, over = {}) => ({ ...structuredClone(sample), id, ...over });
const count = (dir, pred) => fs.readdirSync(path.join(PKG_ROOT, dir), { withFileTypes: true }).filter(pred).length;

// Runs real code on hostile and negative-control inputs and records observed behaviour. Never throws out of a check.
async function assurance() {
  const checks = [];
  const add = async (id, title, expected, fn) => {
    try { const r = await fn(); checks.push({ id, title, expected, observed: r.observed, result: r.skip ? 'skipped' : r.ok ? 'pass' : 'fail' }); }
    catch (e) { checks.push({ id, title, expected, observed: `check threw: ${String(e.message).slice(0, 160)}`, result: 'fail' }); }
  };
  const throwsLike = (fn, re) => { try { fn(); return { ok: false, observed: 'no error thrown' }; } catch (e) { return { ok: re.test(e.message), observed: e.message.slice(0, 140) }; } };
  const canLink = (target, p, type) => { try { fs.symlinkSync(target, p, type); return true; } catch { return false; } };
  const fresh = (id, over) => { const r = tmp('ws'); ensureWorkspace(r); registerSystem(r, sys(id, over), 'audit-runner'); return r; };

  await add('A01', 'Altered audit event is detected', 'chain invalid', () => { const r = fresh('AUD-A01'); const p = path.join(r, '.governsutra/audit.jsonl'); const e = JSON.parse(fs.readFileSync(p, 'utf8').trim().split('\n')[0]); e.action = 'tampered'; fs.writeFileSync(p, JSON.stringify(e) + '\n'); const v = verifyAudit(r); return { ok: !v.valid, observed: `valid=${v.valid}, issues=${v.issues.length}` }; });
  await add('A02', 'Deleted audit event breaks the chain', 'chain invalid', () => {
    const r = fresh('AUD-A02'); fs.writeFileSync(path.join(r, 'm.md'), 'x'); addEvidence(r, { systemId: 'AUD-A02', file: 'm.md' });
    const p = path.join(r, '.governsutra/audit.jsonl'); const lines = fs.readFileSync(p, 'utf8').trim().split('\n'); fs.writeFileSync(p, lines.slice(1).join('\n') + '\n');
    const v = verifyAudit(r); return { ok: !v.valid, observed: `valid=${v.valid}, events=${v.eventCount}` };
  });
  await add('A03', 'Evidence path traversal is refused', 'error "inside the workspace"', () => { const r = fresh('AUD-A03'); return throwsLike(() => addEvidence(r, { systemId: 'AUD-A03', file: '../outside.txt' }), /inside the workspace/); });
  await add('A04', 'Evidence symlink escaping the workspace is refused', 'error mentioning symlink', () => {
    const r = fresh('AUD-A04'); const out = tmp('out'); fs.writeFileSync(path.join(out, 'p.md'), 'external');
    if (!canLink(out, path.join(r, 'link'), 'junction')) return { skip: true, observed: 'host cannot create symlinks without privilege' };
    return throwsLike(() => addEvidence(r, { systemId: 'AUD-A04', file: 'link/p.md' }), /ymlink|symbolic/i);
  });
  await add('A05', 'Secret-like evidence paths are refused (.env, .pem)', 'both refused', () => { const r = fresh('AUD-A05'); fs.writeFileSync(path.join(r, '.env'), 'T=1'); fs.writeFileSync(path.join(r, 'k.pem'), 'x'); const a = throwsLike(() => addEvidence(r, { systemId: 'AUD-A05', file: '.env' }), /Secret-like/); const b = throwsLike(() => addEvidence(r, { systemId: 'AUD-A05', file: 'k.pem' }), /Secret-like/); return { ok: a.ok && b.ok, observed: `${a.observed}; ${b.observed}` }; });
  await add('A06', 'Oversized evidence (>2 MiB) is refused', 'error "exceeds 2 MiB"', () => { const r = fresh('AUD-A06'); fs.writeFileSync(path.join(r, 'big.bin'), Buffer.alloc(2 * 1024 * 1024 + 1)); return throwsLike(() => addEvidence(r, { systemId: 'AUD-A06', file: 'big.bin' }), /exceeds 2 MiB/); });
  await add('A07', 'Scanner never reads .env values', 'canary string absent from output', () => { const r = tmp('scan'); fs.writeFileSync(path.join(r, '.env'), 'OPENAI_API_KEY=CANARY_SECRET_9f3a'); fs.writeFileSync(path.join(r, '.env.example'), 'X=CANARY_SECRET_9f3a'); const out = JSON.stringify(scanRepository(r)); return { ok: !out.includes('CANARY_SECRET_9f3a') && out.includes('deliberately not read'), observed: `canary leaked=${out.includes('CANARY_SECRET_9f3a')}` }; });
  await add('A08', 'Credentials in dependency URLs are redacted', 'password absent', () => { const r = tmp('cred'); fs.writeFileSync(path.join(r, 'package.json'), JSON.stringify({ dependencies: { openai: 'https://user:hunter2@example.invalid/p.tgz' } })); fs.writeFileSync(path.join(r, 'requirements.txt'), 'anthropic @ https://u:hunter2@example.invalid/a.whl\n'); const out = JSON.stringify(scanRepository(r)); return { ok: !out.includes('hunter2'), observed: `leaked=${out.includes('hunter2')}` }; });
  await add('A09', 'Manifest symlinked outside the repository is skipped', 'zero candidates + note', () => { const r = tmp('sl'); const o = tmp('slo'); fs.writeFileSync(path.join(o, 'package.json'), JSON.stringify({ dependencies: { openai: '1.0.0' } })); if (!canLink(path.join(o, 'package.json'), path.join(r, 'package.json'), 'file')) return { skip: true, observed: 'host cannot create symlinks without privilege' }; const x = scanRepository(r); return { ok: x.candidates.length === 0, observed: `${x.candidates.length} candidates` }; });
  await add('A10', 'Unknown risk inputs are never scored low', 'band not low, 6 unknown factors', () => { const r = computeRisk({}); return { ok: r.band !== 'low' && r.unknownFactors.length === 6, observed: `score=${r.score}, band=${r.band}, unknown=${r.unknownFactors.length}` }; });
  await add('A11', 'Control marked verified without evidence fails GOV-004', 'GOV-004 fail', () => { const r = evaluateRules(sys('X', { controls: [{ id: 'C1', status: 'verified-by-named-reviewer', evidenceIds: [] }] })).rules.find((x) => x.id === 'GOV-004'); return { ok: r.status === 'fail', observed: r.status }; });
  await add('A12', 'File presence alone is never verification', 'GOV-004 not pass', () => { const ev = [{ id: 'E1' }]; const r = evaluateRules(sys('X', { controls: [{ id: 'C1', status: 'evidence-attached', evidenceIds: ['E1'] }] }), ev).rules.find((x) => x.id === 'GOV-004'); return { ok: r.status !== 'pass', observed: r.status }; });
  await add('A13', 'Expired exception reopens the finding', 'rule fails again', () => { const s = sys('X', { humanCheckpoints: [], exceptions: [{ id: 'EX1', ruleId: 'GOV-006', rationale: 'r', scope: 's', approver: { name: 'A Human', type: 'human' }, expiresAt: '2020-01-01' }] }); const r = evaluateRules(s).rules.find((x) => x.id === 'GOV-006'); return { ok: r.status === 'fail' && /expired/.test(r.reason), observed: r.status }; });
  await add('A14', 'An agent cannot approve its own exception', 'exception invalid, rule still fails', () => { const s = sys('X', { humanCheckpoints: [], exceptions: [{ id: 'EX2', ruleId: 'GOV-006', rationale: 'r', scope: 's', approver: { name: 'governsutra-prime', type: 'agent' }, expiresAt: '2099-01-01' }] }); const r = evaluateRules(s).rules.find((x) => x.id === 'GOV-006'); return { ok: r.status === 'fail', observed: r.status }; });
  await add('A15', 'Valid human exception is recorded as exception-approved, not pass', 'exception-approved', () => { const s = sys('X', { humanCheckpoints: [], exceptions: [{ id: 'EX3', ruleId: 'GOV-006', rationale: 'r', scope: 's', approver: { name: 'A Human', type: 'human' }, expiresAt: '2099-01-01' }] }); const r = evaluateRules(s).rules.find((x) => x.id === 'GOV-006'); return { ok: r.status === 'exception-approved', observed: r.status }; });
  await add('A16', 'Reports escape HTML and Markdown injection', 'no raw tag, link syntax escaped', () => { const r = fresh('AUD-A16', { name: '<img src=x onerror=alert(1)> [c](javascript:alert(1))' }); const a = assessSystem(r, 'AUD-A16'); const h = renderHtmlReport(a), m = renderMarkdownReport(a); return { ok: !h.includes('<img src=x') && h.includes('&lt;img') && m.includes('\\[c\\]'), observed: `htmlRawTag=${h.includes('<img src=x')}` }; });
  await add('A17', 'A fully declared system is still never auto-approved', 'decision HUMAN_REVIEW_REQUIRED', () => { const r = fresh('AUD-A17'); const a = assessSystem(r, 'AUD-A17'); return { ok: a.decision === 'HUMAN_REVIEW_REQUIRED' && /not legal advice/i.test(a.disclaimer), observed: a.decision }; });
  await add('A18', 'Report text contains no unqualified compliance claim', 'no "is compliant"/"certified" phrasing', () => { const r = fresh('AUD-A18'); const t = renderMarkdownReport(assessSystem(r, 'AUD-A18')); const bad = /\b(is|are|fully|now)\s+(compliant|certified)\b/i.test(t); return { ok: !bad, observed: `claim found=${bad}` }; });
  await add('A19', 'Local API: auth, read-only, no CORS, loopback', '401 / 405 / 403 / 127.0.0.1', async () => {
    const r = fresh('AUD-A19'); const token = 'x'.repeat(32); const srv = createGovernanceServer({ root: r, token });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const port = srv.address().port; const addr = srv.address().address;
    try {
      const u = `http://127.0.0.1:${port}/health`; const h = { Authorization: `Bearer ${token}` };
      const a = (await fetch(u)).status, b = (await fetch(u, { method: 'POST', headers: h })).status, c = (await fetch(u, { headers: { ...h, Origin: 'https://evil.example' } })).status, d = (await fetch(u, { headers: h })).status;
      return { ok: a === 401 && b === 405 && c === 403 && d === 200 && addr === '127.0.0.1', observed: `noAuth=${a} POST=${b} origin=${c} ok=${d} bind=${addr}` };
    } finally { srv.closeAllConnections?.(); await new Promise((ok) => srv.close(ok)); }
  });
  await add('A20', 'Server refuses weak tokens', 'error', () => throwsLike(() => createGovernanceServer({ root: '.', token: 'short' }), /24 characters/));
  await add('A21', 'Manifest with wrong integrity digest is rejected', 'status digest-mismatch, no system', () => { const r = tmp('man'); fs.mkdirSync(path.join(r, 'governance/ai-systems'), { recursive: true }); fs.writeFileSync(path.join(r, 'governance/ai-systems/a.json'), JSON.stringify({ ...sys('MAN-1'), integrity: { sha256: 'f'.repeat(64) } })); const m = loadManifests(r).manifests[0]; return { ok: m.status === 'digest-mismatch' && m.system === null, observed: m.status }; });
  await add('A22', 'Correct manifest digest is verified; invalid manifest is rejected', 'valid + invalid', () => { const r = tmp('man2'); const d = path.join(r, 'governance/ai-systems'); fs.mkdirSync(d, { recursive: true }); const body = sys('MAN-2'); fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ ...body, integrity: { sha256: sha256(Buffer.from(canonical(body))) } })); fs.writeFileSync(path.join(d, 'b.json'), JSON.stringify({ id: 'bad' })); fs.writeFileSync(path.join(d, 'c.json'), '{not json'); const ms = loadManifests(r).manifests; const by = Object.fromEntries(ms.map((m) => [path.basename(m.path), m.status])); return { ok: by['a.json'] === 'valid' && by['b.json'] === 'invalid' && by['c.json'] === 'invalid-json', observed: JSON.stringify(by) }; });
  await add('A23', 'Manifest count is bounded (200 max)', '200 read + note', () => { const r = tmp('many'); const d = path.join(r, 'governance/ai-systems'); fs.mkdirSync(d, { recursive: true }); for (let i = 0; i < 205; i++) fs.writeFileSync(path.join(d, `s${String(i).padStart(3, '0')}.json`), '{}'); const m = loadManifests(r); return { ok: m.manifests.length === 200 && m.notes.some((n) => /only the first 200/.test(n)), observed: `${m.manifests.length} read` }; });
  await add('A24', 'Imported manifest never overwrites an existing system', 'skipped, not replaced', () => { const r = tmp('imp'); const repo = tmp('imprepo'); ensureWorkspace(r); registerSystem(r, sys('MAN-3', { owner: 'Original Owner' })); const d = path.join(repo, 'governance/ai-systems'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify(sys('MAN-3', { owner: 'Attacker' }))); const res = importManifests(r, repo); return { ok: res.skipped.length === 1 && res.imported.length === 0, observed: `imported=${res.imported.length} skipped=${res.skipped.length}` }; });
  await add('A25', 'Lockfile yields the exact resolved version with a JSON pointer', 'version 4.2.1 + pointer', () => { const r = tmp('lock'); fs.writeFileSync(path.join(r, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/openai': { version: '4.2.1' } } })); const c = scanRepository(r).candidates.find((x) => x.type === 'sdk-dependency-resolved'); return { ok: c?.version === '4.2.1' && c.pointer === '/packages/node_modules~1openai' && /^[a-f0-9]{64}$/.test(c.sourceSha256), observed: c ? `${c.version} ${c.pointer}` : 'not found' }; });
  await add('A26', 'Model version change triggers re-review', 'model-change-review trigger', () => { const a = sys('D'); const b = sys('D'); b.models[0].version = '2027-01-01'; const d = diffSystems(a, b); return { ok: d.reReviewTriggers.includes('model-change-review') && d.changeCount === 1, observed: `${d.changeCount} change, triggers=${d.reReviewTriggers.join(',')}` }; });
  await add('A27', 'Host adapter install refuses to overwrite without --force', 'refusal then success', () => { const t = tmp('ide'); installHost({ host: 'cursor', target: t }); const x = throwsLike(() => installHost({ host: 'cursor', target: t }), /Refusing to overwrite/); if (!x.ok) return x; installHost({ host: 'cursor', target: t, force: true }); return { ok: true, observed: x.observed }; });
  await add('A28', 'Host name path traversal is refused', 'Unsupported host adapter', () => throwsLike(() => installHost({ host: '../..', target: tmp('ide2') }), /Unsupported host adapter/));
  await add('A29', 'Sealed report detects later edits', 'verifySeal false after edit', () => { const s = seal({ a: 1, b: [1, 2] }); const ok1 = verifySeal(s); s.b.push(3); return { ok: ok1 && !verifySeal(s), observed: `intact=${ok1}, afterEdit=${verifySeal(s)}` }; });
  await add('A30', 'Shipped inventory matches claims (20 agents, 26 skills, 10 rules, 8 workflows)', 'counts equal', () => {
    const agents = count('agents', (d) => d.isFile() && /^governsutra-.*\.md$/.test(d.name)), skills = count('skills', (d) => d.isDirectory() && fs.existsSync(path.join(PKG_ROOT, 'skills', d.name, 'SKILL.md'))), rules = count('rules', (d) => d.isFile() && /^gov-\d+\.md$/.test(d.name)), wf = count('workflows', (d) => d.isFile() && /\.md$/.test(d.name));
    return { ok: agents === 20 && skills === 26 && rules === 10 && wf === 8, observed: `agents=${agents} skills=${skills} rules=${rules} workflows=${wf}` };
  });
  await add('A31', 'Every agent and skill file states its boundaries (no compliance claims, human authority)', 'all files mention human/unknown rule', () => {
    const files = [...fs.readdirSync(path.join(PKG_ROOT, 'agents')).filter((f) => f.endsWith('.md')).map((f) => path.join('agents', f)), ...fs.readdirSync(path.join(PKG_ROOT, 'skills')).map((d) => path.join('skills', d, 'SKILL.md'))];
    const weak = files.filter((f) => { const t = fs.readFileSync(path.join(PKG_ROOT, f), 'utf8'); return !/human|owner|unknown|never/i.test(t); });
    return { ok: weak.length === 0, observed: `${files.length} files checked, ${weak.length} without boundary language` };
  });
  return checks;
}

export async function runAudit() {
  const checks = await assurance();
  const passed = checks.filter((c) => c.result === 'pass').length, failed = checks.filter((c) => c.result === 'fail').length, skipped = checks.filter((c) => c.result === 'skipped').length;

  const ws = tmp('sample'); ensureWorkspace(ws);
  registerSystem(ws, sample, 'audit-runner');
  const assessment = assessSystem(ws, sample.id);
  const scan = scanRepository(path.join(PKG_ROOT, 'fixtures', 'sample-repo'));
  const changed = structuredClone(sample); changed.tools[0].permissions.push('write:tickets');
  const diff = diffSystems(sample, changed);
  const byStatus = (s) => assessment.rules.filter((r) => r.status === s).length;
  const samples = [
    { capability: 'assess (fixture AI-SYS-001)', result: `risk ${assessment.risk.score}/100 (${assessment.risk.band}); rules pass=${byStatus('pass')} fail=${byStatus('fail')} unknown=${byStatus('unknown')} n/a=${byStatus('not-applicable')}; decision ${assessment.decision}` },
    { capability: 'scan (fixtures/sample-repo)', result: `${scan.candidates.length} candidates from ${scan.sourceFiles.length} allowlisted files; notes: ${scan.notes.length}` },
    { capability: 'diff (tool permission added)', result: `${diff.changeCount} change; triggers ${diff.reReviewTriggers.join(', ')}` },
    { capability: 'audit chain (fixture workspace)', result: (() => { const v = verifyAudit(ws); return `valid=${v.valid}, events=${v.eventCount}`; })() }
  ];
  const report = {
    schema: 'governsutra.audit.v1', toolVersion: VERSION, recordedAt: now(),
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    inventory: { agents: count('agents', (d) => d.isFile() && /^governsutra-.*\.md$/.test(d.name)), skills: count('skills', (d) => d.isDirectory()), rules: 10, workflows: count('workflows', (d) => d.isFile()), hostAdapters: count('adapters/ide', (d) => d.isDirectory()), runtimeDependencies: 0 },
    independence: 'Automated self-assurance: the tool exercises its own code on hostile inputs. It is not a third-party audit. A truly independent assessment needs a qualified human outside the project.',
    verdictRule: 'ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED means every executed check behaved as specified. It is never an approval, certification or compliance statement. Any failed check gives ASSURANCE_CHECKS_FAILED. Skipped checks are listed, not counted as passes.',
    verdict: failed ? 'ASSURANCE_CHECKS_FAILED' : 'ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED',
    assurance: { total: checks.length, passed, failed, skipped, checks },
    samples,
    evidenceTiers: [
      { artifact: 'Assurance checks (this report)', tier: 'executed', proves: 'Code behaved as specified on the listed inputs on this host and Node version.', doesNotProve: 'Behaviour on other inputs, hosts or future versions.' },
      { artifact: 'Hash-chained audit.jsonl', tier: 'tamper-evident', proves: 'Accidental or partial edits to the event log are detectable.', doesNotProve: 'Authorship, or integrity against an admin who rewrites the whole chain.' },
      { artifact: 'Evidence references (SHA-256)', tier: 'digest-only', proves: 'File bytes matched at recording time.', doesNotProve: 'That the file content is true, complete or verified by a human.' },
      { artifact: 'Owner declarations in registry', tier: 'declared', proves: 'What an owner stated.', doesNotProve: 'That the statement is accurate.' },
      { artifact: 'Repository scan candidates', tier: 'observed', proves: 'A declared dependency or MCP entry exists in an allowlisted file.', doesNotProve: 'That it runs in production or that the inventory is complete.' },
      { artifact: 'Risk score', tier: 'heuristic', proves: 'A transparent weighted prioritization of declared inputs.', doesNotProve: 'Legal risk category, safety or harm likelihood.' }
    ],
    notTested: [
      'Legal compliance, certification or regulatory classification (never performed by this tool).',
      'Native execution of the 20 agent definitions or 26 skills inside any IDE (adapters are instruction files only).',
      'macOS, Linux and Windows behaviour beyond the host named above (see CI matrix for hosted runs).',
      'Digital signatures, key management, WORM storage, multi-tenant isolation, encryption at rest (planned, not built).',
      'Accuracy of owner declarations, model cards or vendor statements.',
      'Runtime behaviour of any AI system being governed.'
    ]
  };
  fs.rmSync(ws, { recursive: true, force: true });
  return seal(report);
}
