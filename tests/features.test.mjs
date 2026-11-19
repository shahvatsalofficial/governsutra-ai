import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  ensureWorkspace, registerSystem, assessSystem, addEvidence, verifyEvidence, scanRepository, loadManifests, importManifests, diffSystems, diffScans, diffAny,
  evaluateRules, computeRisk, validateSystem, seal, verifySeal, readAudit, verifyAudit, VERSION
} from '../packages/core/index.mjs';
import { runAudit } from '../packages/core/audit.mjs';
import { installHost, listHosts } from '../packages/core/install.mjs';
import { renderMarkdown, renderHtml } from '../packages/reporting/index.mjs';
import { canonical, sha256, isInside } from '../packages/core/util.mjs';
import sample from '../fixtures/sample-system.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'packages/cli/index.mjs');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'govsut-feat-'));
const sys = (id, over = {}) => ({ ...structuredClone(sample), id, ...over });
const run = (args, cwd = root) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
const human = { name: 'A. Human', type: 'human' };
const ex = (over = {}) => ({ id: 'EX-1', ruleId: 'GOV-006', rationale: 'temporary', scope: 'staging', approver: human, expiresAt: '2099-01-01', ...over });

test('version is consistent across package.json, code and plugin manifest', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, VERSION);
  assert.equal(pkg.private, false);
  assert.equal(pkg.name, 'governsutra-ai');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8')).version, VERSION);
  assert.match(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), new RegExp('version: ' + VERSION.replaceAll('.', '\.')));
  assert.match(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), new RegExp('## ' + VERSION.replaceAll('.', '\.')));
});

test('every rule returns pass, fail, unknown or not-applicable with a reason', () => {
  const { rules } = evaluateRules(sys('X'));
  assert.equal(rules.length, 10);
  for (const r of rules) { assert.ok(['pass', 'fail', 'unknown', 'not-applicable', 'exception-approved'].includes(r.status)); assert.ok(r.reason.length > 0); }
});

test('empty system fails or unknowns, never passes accountability or checkpoints', () => {
  const { rules } = evaluateRules({ id: 'X' });
  const by = Object.fromEntries(rules.map((r) => [r.id, r.status]));
  assert.equal(by['GOV-001'], 'fail'); assert.equal(by['GOV-002'], 'fail'); assert.equal(by['GOV-006'], 'fail'); assert.equal(by['GOV-008'], 'unknown'); assert.equal(by['GOV-004'], 'unknown');
});

test('GOV-004: verified control needs resolvable evidence and a named verifier', () => {
  const s = sys('X', { controls: [{ id: 'C', status: 'verified-by-named-reviewer', evidenceIds: ['E1'], verifier: 'Jane Reviewer' }] });
  assert.equal(evaluateRules(s, [{ id: 'E1' }]).rules.find((r) => r.id === 'GOV-004').status, 'pass');
  assert.equal(evaluateRules(s, []).rules.find((r) => r.id === 'GOV-004').status, 'fail');
  const noVerifier = sys('X', { controls: [{ id: 'C', status: 'verified-by-named-reviewer', evidenceIds: ['E1'] }] });
  assert.equal(evaluateRules(noVerifier, [{ id: 'E1' }]).rules.find((r) => r.id === 'GOV-004').status, 'fail');
});

test('GOV-004: expired evidence is unknown, not pass', () => {
  const s = sys('X', { controls: [{ id: 'C', status: 'verified-by-named-reviewer', evidenceIds: ['E1'], verifier: 'Jane' }] });
  const r = evaluateRules(s, [{ id: 'E1', expiresAt: '2020-01-01' }]).rules.find((x) => x.id === 'GOV-004');
  assert.equal(r.status, 'unknown');
});

test('GOV-005 fails when raw data is flagged attached', () => {
  const s = sys('X'); s.dataSources[0].rawDataAttached = true;
  assert.equal(evaluateRules(s).rules.find((r) => r.id === 'GOV-005').status, 'fail');
});

test('GOV-009 fails for a tool without permissions', () => {
  const s = sys('X'); s.tools[0].permissions = [];
  assert.equal(evaluateRules(s).rules.find((r) => r.id === 'GOV-009').status, 'fail');
});

test('GOV-010 fails when an active system review date has passed', () => {
  const s = sys('X', { lifecycle: 'active', nextReviewAt: '2020-01-01' });
  assert.equal(evaluateRules(s).rules.find((r) => r.id === 'GOV-010').status, 'fail');
  assert.equal(evaluateRules(sys('X', { lifecycle: 'draft' })).rules.find((r) => r.id === 'GOV-010').status, 'not-applicable');
});

test('exceptions: active human approval gives exception-approved; agent, expired and incomplete do not', () => {
  const gov6 = (e) => evaluateRules(sys('X', { humanCheckpoints: [], exceptions: [e] })).rules.find((r) => r.id === 'GOV-006');
  assert.equal(gov6(ex()).status, 'exception-approved');
  assert.equal(gov6(ex({ approver: { name: 'governsutra-prime', type: 'agent' } })).status, 'fail');
  assert.equal(gov6(ex({ approver: { name: 'x' } })).status, 'fail');
  assert.equal(gov6(ex({ expiresAt: '2020-01-01' })).status, 'fail');
  assert.equal(gov6(ex({ rationale: '' })).status, 'fail');
  assert.equal(gov6(ex({ ruleId: 'GOV-001' })).status, 'fail');
});

test('control status vocabulary is enforced', () => {
  assert.ok(validateSystem(sys('X', { controls: [{ id: 'C', status: 'verified' }] })).some((e) => /invalid status/.test(e)));
  assert.deepEqual(validateSystem(sys('XX', { controls: [{ id: 'C', status: 'planned' }] })), []);
});

test('validation rejects out-of-range and mistyped risk fields', () => {
  assert.ok(validateSystem(sys('X', { risk: { decisionImpact: 9 } })).length);
  assert.ok(validateSystem(sys('X', { risk: { autonomy: 'robot' } })).length);
  assert.ok(validateSystem(sys('X', { risk: 'high' })).length);
  assert.ok(validateSystem(sys('X', { nextReviewAt: 'someday' })).length);
});

test('risk sensitivity brackets the score for every factor', () => {
  const r = computeRisk(sample);
  assert.equal(r.sensitivity.length, 6);
  for (const s of r.sensitivity) { assert.ok(s.scoreIfMin <= r.score && r.score <= s.scoreIfMax); }
  assert.match(r.missingDataBehavior, /never treated as low/);
});

test('assessment contains rules, evidence digests, unknowns, limitations and never approves', () => {
  const r = temp(); ensureWorkspace(r); registerSystem(r, sys('AS-1'));
  fs.writeFileSync(path.join(r, 'card.md'), 'model card metadata');
  const e = addEvidence(r, { systemId: 'AS-1', file: 'card.md', expiresAt: '2099-01-01', verifier: 'Jane' });
  const a = assessSystem(r, 'AS-1');
  assert.equal(a.schema, 'governsutra.assessment.v2');
  assert.equal(a.decision, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(a.evidence[0].sha256, e.sha256);
  assert.ok(a.limitations.length >= 3);
  assert.ok(a.scope.boundary);
});

test('evidence verify detects changed, missing and expired files', () => {
  const r = temp(); ensureWorkspace(r); registerSystem(r, sys('EV-1'));
  fs.writeFileSync(path.join(r, 'a.md'), 'one'); fs.writeFileSync(path.join(r, 'b.md'), 'two'); fs.writeFileSync(path.join(r, 'c.md'), 'three');
  addEvidence(r, { systemId: 'EV-1', file: 'a.md' }); addEvidence(r, { systemId: 'EV-1', file: 'b.md' }); addEvidence(r, { systemId: 'EV-1', file: 'c.md', expiresAt: '2020-01-01' });
  assert.deepEqual(verifyEvidence(r, 'EV-1').map((x) => x.state), ['ok', 'ok', 'expired']);
  fs.writeFileSync(path.join(r, 'a.md'), 'changed'); fs.rmSync(path.join(r, 'b.md'));
  assert.deepEqual(verifyEvidence(r, 'EV-1').map((x) => x.state), ['digest-changed', 'missing', 'expired']);
});

test('evidence cannot be the governance workspace itself or a key file', () => {
  const r = temp(); ensureWorkspace(r); registerSystem(r, sys('EV-2'));
  assert.throws(() => addEvidence(r, { systemId: 'EV-2', file: '.governsutra/registry.json' }), /workspace state|Secret-like/);
  fs.writeFileSync(path.join(r, 'id.pem'), 'x');
  assert.throws(() => addEvidence(r, { systemId: 'EV-2', file: 'id.pem' }), /Secret-like/);
  assert.throws(() => addEvidence(r, { systemId: 'EV-2', file: '.' }), /inside the workspace/);
  assert.throws(() => addEvidence(r, { systemId: 'EV-2', file: 'x.md', expiresAt: 'soon' }), /ISO date/);
});

test('evidence for an unknown system is refused before any file is read', () => {
  const r = temp(); ensureWorkspace(r); fs.writeFileSync(path.join(r, 'a.md'), 'x');
  assert.throws(() => addEvidence(r, { systemId: 'nope', file: 'a.md' }), /Unknown system/);
});

test('audit log records registration, evidence and report events and stays valid', () => {
  const r = temp(); ensureWorkspace(r); registerSystem(r, sys('AU-1'));
  fs.writeFileSync(path.join(r, 'a.md'), 'x'); addEvidence(r, { systemId: 'AU-1', file: 'a.md' });
  assert.deepEqual(readAudit(r).map((e) => e.action), ['system.registered', 'evidence.added']);
  assert.equal(verifyAudit(r).valid, true);
});

test('lockfile v3 and v1 formats give exact resolved versions with pointers and digests', () => {
  const r = temp();
  fs.writeFileSync(path.join(r, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/@anthropic-ai/sdk': { version: '0.30.1' }, 'node_modules/a/node_modules/openai': { version: '4.0.0' }, 'node_modules/left-pad': { version: '1.0.0' } } }));
  const c = scanRepository(r).candidates;
  assert.equal(c.length, 2);
  assert.ok(c.every((x) => x.type === 'sdk-dependency-resolved' && /^[a-f0-9]{64}$/.test(x.sourceSha256)));
  const r2 = temp();
  fs.writeFileSync(path.join(r2, 'package-lock.json'), JSON.stringify({ lockfileVersion: 1, dependencies: { openai: { version: '3.3.0' } } }));
  assert.equal(scanRepository(r2).candidates[0].version, '3.3.0');
});

test('poetry.lock and requirements pins are parsed', () => {
  const r = temp();
  fs.writeFileSync(path.join(r, 'poetry.lock'), '[[package]]\nname = "openai"\nversion = "1.40.0"\n\n[[package]]\nname = "requests"\nversion = "2.0.0"\n');
  fs.writeFileSync(path.join(r, 'requirements.txt'), 'anthropic==0.34.0\nflask==3.0\n');
  const c = scanRepository(r).candidates;
  assert.ok(c.some((x) => x.type === 'python-dependency-resolved' && x.version === '1.40.0'));
  assert.ok(c.some((x) => x.type === 'python-dependency' && x.version === '==0.34.0' && x.line === 1));
});

test('package.json candidates carry a JSON pointer and line', () => {
  const c = scanRepository(path.join(root, 'fixtures/sample-repo')).candidates.find((x) => x.name === 'OpenAI API SDK' && x.source === 'package.json');
  assert.equal(c.pointer, '/dependencies/openai');
  assert.ok(c.line > 0);
});

test('malformed manifests and lockfiles never throw', () => {
  const r = temp();
  for (const f of ['package.json', 'package-lock.json', '.mcp.json']) fs.writeFileSync(path.join(r, f), '{broken');
  const x = scanRepository(r);
  assert.equal(x.candidates.length, 0);
  assert.ok(x.notes.length >= 3);
});

test('MCP remote URLs are not copied into scan results', () => {
  const r = temp();
  fs.writeFileSync(path.join(r, '.mcp.json'), JSON.stringify({ mcpServers: { remote: { url: 'https://user:tok3n@example.invalid/mcp?key=abc' } } }));
  const out = JSON.stringify(scanRepository(r));
  assert.ok(!out.includes('tok3n') && !out.includes('key=abc'));
});

test('manifest loader verifies digests and rejects tampered or invalid manifests', () => {
  const m = loadManifests(path.join(root, 'fixtures/sample-repo'));
  assert.equal(m.manifests.length, 1);
  assert.equal(m.manifests[0].digest, 'digest-verified');
  assert.equal(m.manifests[0].status, 'valid');
  const r = temp(); const d = path.join(r, 'governance/ai-systems'); fs.mkdirSync(d, { recursive: true });
  const body = sys('T-1'); const good = sha256(Buffer.from(canonical(body)));
  fs.writeFileSync(path.join(d, 'a.json'), JSON.stringify({ ...body, owner: 'Changed Later', integrity: { sha256: good } }));
  assert.equal(loadManifests(r).manifests[0].status, 'digest-mismatch');
});

test('manifest files that are huge are skipped, not read', () => {
  const r = temp(); const d = path.join(r, 'governance/ai-systems'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'big.json'), Buffer.alloc(2 * 1024 * 1024 + 1, 32));
  const m = loadManifests(r);
  assert.equal(m.manifests[0].status, 'skipped');
});

test('importManifests registers valid manifests as unconfirmed repository declarations', () => {
  const r = temp(); ensureWorkspace(r);
  const res = importManifests(r, path.join(root, 'fixtures/sample-repo'), 'tester');
  assert.equal(res.imported.length, 1);
  const a = assessSystem(r, 'AI-SYS-002');
  assert.equal(a.scope.provenance.kind, 'repository-manifest');
  assert.equal(a.scope.provenance.confirmedByOwner, false);
  assert.equal(importManifests(r, path.join(root, 'fixtures/sample-repo')).skipped.length, 1);
});

test('diff flags model, tool, data, owner and intended-use changes with re-review triggers', () => {
  const b = structuredClone(sample);
  b.models[0].version = '2027-01-01'; b.tools.push({ name: 'New Tool', version: '1', permissions: ['read'] }); b.dataSources = []; b.owner = 'Someone Else'; b.intendedUse = 'changed use';
  const d = diffSystems(sample, b);
  assert.deepEqual([...d.reReviewTriggers].sort(), ['data-change-review', 'intended-use-review', 'model-change-review', 'ownership-review', 'tool-permission-review']);
  assert.equal(d.decision, 'RE_REVIEW_RECOMMENDED_HUMAN_DECIDES');
  assert.equal(diffSystems(sample, structuredClone(sample)).decision, 'NO_CHANGE_DETECTED');
});

test('diff reports changed fields for a tool permission change', () => {
  const b = structuredClone(sample); b.tools[0].permissions.push('write:x');
  const c = diffSystems(sample, b).changes[0];
  assert.equal(c.kind, 'changed'); assert.deepEqual(c.changedFields, ['permissions']);
});

test('scan diff detects added, changed and removed candidates; mixed kinds are refused', () => {
  const a = { candidates: [{ type: 'sdk-dependency', name: 'OpenAI', source: 'package.json', version: '1' }, { type: 'mcp-server', name: 'old', source: '.mcp.json', version: 'unknown' }] };
  const b = { candidates: [{ type: 'sdk-dependency', name: 'OpenAI', source: 'package.json', version: '2' }, { type: 'mcp-server', name: 'new', source: '.mcp.json', version: 'unknown' }] };
  assert.deepEqual(diffScans(a, b).changes.map((c) => c.kind).sort(), ['added', 'changed', 'removed']);
  assert.throws(() => diffAny(a, sample), /same kind/);
});

test('seal detects edits and canonical form ignores key order', () => {
  const s = seal({ b: 2, a: 1 });
  assert.equal(verifySeal(s), true);
  assert.equal(verifySeal({ ...s, a: 9 }), false);
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
});

test('isInside is separator-safe', () => {
  const base = path.resolve('/a/b');
  assert.equal(isInside(base, path.resolve('/a/b/c')), true);
  assert.equal(isInside(base, path.resolve('/a/bc')), false);
  assert.equal(isInside(base, path.resolve('/a')), false);
});

test('independent audit runs, passes, seals and renders MD and HTML', async () => {
  const r = await runAudit();
  assert.equal(r.verdict, 'ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED', JSON.stringify(r.assurance.checks.filter((c) => c.result === 'fail')));
  assert.ok(r.assurance.total >= 30);
  assert.equal(r.assurance.failed, 0);
  assert.equal(verifySeal(r), true);
  const md = renderMarkdown(r), html = renderHtml(r);
  assert.match(md, /not legal advice/i); assert.match(html, /not legal advice/i);
  assert.match(html, /prefers-color-scheme/);
  assert.match(r.independence, /not a third-party audit/);
});

test('audit report seal breaks when a check result is edited', async () => {
  const r = await runAudit();
  r.assurance.checks[0].result = 'pass'; r.assurance.passed = 999;
  assert.equal(verifySeal(r), false);
});

test('installHost: dry-run writes nothing, bad hosts refused, all 9 hosts install', () => {
  const t = temp();
  const d = installHost({ host: 'claude', target: t, dryRun: true });
  assert.ok(d.files > 20); assert.equal(fs.readdirSync(t).length, 0);
  for (const bad of ['..', 'a/b', '', 'CURSOR', 'nope']) assert.throws(() => installHost({ host: bad, target: t }), /Unsupported host/);
  assert.equal(listHosts().length, 9);
  for (const h of listHosts()) installHost({ host: h, target: fs.mkdtempSync(path.join(os.tmpdir(), 'govsut-h-')) });
});

test('installHost refusal leaves no partial install', () => {
  const t = temp(); fs.mkdirSync(path.join(t, 'governsutra'), { recursive: true }); fs.writeFileSync(path.join(t, 'governsutra', 'AGENTS.md'), 'mine');
  assert.throws(() => installHost({ host: 'cursor', target: t }), /Refusing to overwrite/);
  assert.equal(fs.existsSync(path.join(t, '.cursor')), false);
  assert.equal(fs.readFileSync(path.join(t, 'governsutra', 'AGENTS.md'), 'utf8'), 'mine');
});

test('CLI: version, help, strict option parsing', () => {
  assert.equal(run(['version']).stdout.trim(), VERSION);
  assert.equal(run(['--version']).stdout.trim(), VERSION);
  assert.match(run(['help']).stdout, /Know the system/);
  assert.notEqual(run(['list', '--root']).status, 0);
  assert.match(run(['list', '--root', temp(), '--root', temp()]).stderr, /Duplicate option/);
  assert.match(run(['nonsense']).stderr, /Unknown command/);
});

test('CLI works from any directory (package-root resolution)', () => {
  const t = temp(), cwd = temp();
  const x = run(['install-ide', '--host', 'codex', '--target', t], cwd);
  assert.equal(x.status, 0, x.stderr);
  assert.ok(fs.existsSync(path.join(t, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(t, 'governsutra/skills/governsutra-prime/SKILL.md')));
});

test('CLI end to end: register, assess in 3 formats, evidence, report, diff, audit verify', () => {
  const r = temp();
  assert.equal(run(['register', '--root', r, '--input', path.join(root, 'fixtures/sample-system.json')]).status, 0);
  for (const f of ['json', 'md', 'html']) { const x = run(['assess', '--root', r, '--id', 'AI-SYS-001', '--format', f]); assert.equal(x.status, 0, x.stderr); assert.match(x.stdout, /HUMAN_REVIEW_REQUIRED/); }
  assert.notEqual(run(['assess', '--root', r, '--id', 'AI-SYS-001', '--format', 'pdf']).status, 0);
  fs.writeFileSync(path.join(r, 'card.md'), 'x');
  assert.equal(run(['evidence', 'add', '--root', r, '--id', 'AI-SYS-001', '--file', 'card.md', '--verifier', 'Jane']).status, 0);
  assert.equal(run(['evidence', 'verify', '--root', r]).status, 0);
  fs.writeFileSync(path.join(r, 'card.md'), 'changed');
  assert.equal(run(['evidence', 'verify', '--root', r]).status, 2);
  const out = path.join(r, 'rep');
  assert.equal(run(['report', '--root', r, '--id', 'AI-SYS-001', '--out', out]).status, 0);
  assert.ok(['json', 'md', 'html'].every((e) => fs.existsSync(path.join(out, `assessment.${e}`))));
  const b = structuredClone(sample); b.models[0].version = 'x'; fs.writeFileSync(path.join(r, 'b.json'), JSON.stringify(b));
  const d = run(['diff', '--a', path.join(root, 'fixtures/sample-system.json'), '--b', path.join(r, 'b.json'), '--format', 'md']);
  assert.equal(d.status, 0, d.stderr); assert.match(d.stdout, /model-change-review/);
  const v = run(['audit', 'verify', '--root', r]); assert.equal(v.status, 0); assert.match(v.stdout, /"valid": true/);
});

test('CLI audit writes three files, refuses overwrite without --force, and verify checks the seal', () => {
  const out = path.join(temp(), 'a');
  let x = run(['audit', '--out', out, '--quiet']); assert.equal(x.status, 0, x.stderr + x.stdout);
  assert.ok(['json', 'md', 'html'].every((e) => fs.existsSync(path.join(out, `audit-report.${e}`))));
  x = run(['audit', '--out', out, '--quiet']); assert.notEqual(x.status, 0);
  assert.equal(run(['audit', '--out', out, '--quiet', '--force']).status, 0);
  assert.equal(run(['verify', '--report', path.join(out, 'audit-report.json')]).status, 0);
  const j = JSON.parse(fs.readFileSync(path.join(out, 'audit-report.json'), 'utf8')); j.verdict = 'EDITED';
  fs.writeFileSync(path.join(out, 'bad.json'), JSON.stringify(j));
  assert.equal(run(['verify', '--report', path.join(out, 'bad.json')]).status, 2);
});

test('CLI import-manifests and scan on the fixture repository', () => {
  const r = temp();
  let x = run(['import-manifests', '--root', r, '--repo', path.join(root, 'fixtures/sample-repo')]); assert.equal(x.status, 0, x.stderr); assert.match(x.stdout, /AI-SYS-002/);
  x = run(['scan', '--root', r, '--repo', path.join(root, 'fixtures/sample-repo')]); assert.equal(x.status, 0, x.stderr);
  assert.ok(fs.existsSync(path.join(r, '.governsutra/scans/latest.json')));
});

test('CLI serve refuses a missing or short token', () => {
  const x = spawnSync(process.execPath, [cli, 'serve', '--root', temp()], { encoding: 'utf8', env: { ...process.env, GOVSUTRA_TOKEN: 'short' } });
  assert.notEqual(x.status, 0); assert.match(x.stderr, /24 characters/);
});

test('reports escape every untrusted field (rule reasons, tool names, data sources)', () => {
  const r = temp(); ensureWorkspace(r);
  const s = sys('ESC-1'); s.tools[0].name = '<script>alert(1)</script>'; s.dataSources[0].name = '"><svg onload=x>'; s.tools[0].permissions = [];
  registerSystem(r, s);
  const a = assessSystem(r, 'ESC-1'); const h = renderHtml(a);
  assert.ok(!h.includes('<script>alert') && !h.includes('<svg onload'));
});

test('every skill has valid frontmatter and concrete tool support; every agent has a mirrored host file', () => {
  for (const d of fs.readdirSync(path.join(root, 'skills'))) {
    const text = fs.readFileSync(path.join(root, 'skills', d, 'SKILL.md'), 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm, d + ' has no frontmatter');
    assert.equal(fm[1].match(/^name:\s*(.+)$/m)[1].trim(), d);
    assert.ok(fm[1].match(/^description:\s*(.+)$/m)[1].length > 30, d + ' description too short');
    assert.match(text, /## Tool support \(GovernSutra CLI\)/, d + ' lacks tool support');
    assert.match(text, /governsutra [a-z-]+/, d + ' names no command');
    assert.match(text, /Stop conditions/, d);
  }
  const man = JSON.parse(fs.readFileSync(path.join(root, 'agents/manifest.json'), 'utf8'));
  assert.equal(man.agents.length, 20);
  for (const a of man.agents) assert.equal(fs.readFileSync(path.join(root, a.instructionFile), 'utf8'), fs.readFileSync(path.join(root, '.claude/agents', a.id + '.md'), 'utf8'), a.id + ' host copy drifted');
});

test('system schema covers exceptions with a human-only approver and the control status vocabulary', () => {
  const s = JSON.parse(fs.readFileSync(path.join(root, 'schemas/system.schema.json'), 'utf8'));
  assert.equal(s.properties.exceptions.items.properties.approver.properties.type.const, 'human');
  assert.deepEqual(s.properties.controls.items.properties.status.enum.length, 8);
});
