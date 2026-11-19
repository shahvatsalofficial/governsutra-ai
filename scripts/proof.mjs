#!/usr/bin/env node
// Regenerates docs/proof/: raw TAP test log, environment, fuzz results, CLI transcripts, a sample audit report and SHA256SUMS.
// Everything here is machine output from this host. Nothing is hand-edited.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSystem, registerSystem, ensureWorkspace, assessSystem, scanRepository, computeRisk, evaluateRules, verifyAudit, VERSION } from '../packages/core/index.mjs';
import { runAudit } from '../packages/core/audit.mjs';
import { formats, renderHtml, renderMarkdown } from '../packages/reporting/index.mjs';
import { sha256 } from '../packages/core/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'proof');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const cli = path.join(ROOT, 'packages/cli/index.mjs');

// 1. Raw TAP test run
const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join('tests', f));
const t = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...testFiles], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(OUT, 'test-run.tap'), t.stdout);
const num = (k) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(t.stdout)?.[1] ?? NaN);
const tests = num('tests'), pass = num('pass'), fail = num('fail'), skipped = num('skipped');

// 2. Deterministic fuzzing of the parsers and evaluators
let seed = 20261119;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const junk = () => pick([null, undefined, 0, -1, 1e999, NaN, '', ' ', 'x'.repeat(5000), '<script>alert(1)</script>', '[a](javascript:x)', '../../etc/passwd', '\u0000', true, [], {}, [[]], { a: { b: [1, 2, { c: null }] } }, '"; DROP TABLE', '${7*7}', '‮', 'A'.repeat(81)]);
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/sample-system.json'), 'utf8'));
const fields = ['id', 'name', 'intendedUse', 'owner', 'riskOwner', 'models', 'tools', 'dataSources', 'humanCheckpoints', 'prohibitedUses', 'controls', 'exceptions', 'risk', 'lifecycle', 'nextReviewAt', 'deploymentContext'];
const fuzz = { schema: 'governsutra.fuzz.v1', seed: 20261119, systemCases: 0, validated: 0, rejected: 0, evaluated: 0, unexpectedExceptions: 0, invariantViolations: 0, scanCases: 0, scanUnexpected: 0, notes: [] };
for (let i = 0; i < 3000; i++) {
  const s = structuredClone(base);
  for (let k = 0, n = 1 + Math.floor(rnd() * 3); k < n; k++) s[pick(fields)] = junk();
  fuzz.systemCases++;
  try {
    const errs = validateSystem(s);
    if (errs.length) { fuzz.rejected++; continue; }
    fuzz.validated++;
    const { rules } = evaluateRules(s, []);
    const risk = computeRisk(s);
    fuzz.evaluated++;
    if (!rules.every((r) => ['pass', 'fail', 'unknown', 'not-applicable', 'exception-approved'].includes(r.status))) fuzz.invariantViolations++;
    if (risk.unknownFactors.length && risk.band === 'low' && risk.score < 25 && risk.unknownFactors.length === 6) fuzz.invariantViolations++;
    if (risk.score < 0 || risk.score > 100 || !Number.isFinite(risk.score)) fuzz.invariantViolations++;
  } catch (e) { fuzz.unexpectedExceptions++; if (fuzz.notes.length < 5) fuzz.notes.push(String(e.message).slice(0, 120)); }
}
// Hostile manifests through the scanner
const manifests = ['package.json', 'package-lock.json', 'requirements.txt', 'pyproject.toml', 'poetry.lock', '.mcp.json'];
for (let i = 0; i < 300; i++) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'govsut-fuzz-'));
  try {
    for (const m of manifests) if (rnd() < 0.7) fs.writeFileSync(path.join(dir, m), (pick([JSON.stringify({ dependencies: { openai: junk() }, mcpServers: { [String(junk())]: junk() } }), JSON.stringify(junk()), '{' + 'x'.repeat(rnd() * 100), '[[package]]\nname = "openai"\nversion = ' + String(junk()), 'openai==' + String(junk()), '']) ?? 'null'));
    fuzz.scanCases++;
    const r = scanRepository(dir);
    if (!Array.isArray(r.candidates)) fuzz.scanUnexpected++;
  } catch { fuzz.scanUnexpected++; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// Injection through a registered record into both renderers
fuzz.rendererCases = 0; fuzz.rendererEscapeFailures = 0;
for (let i = 0; i < 200; i++) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'govsut-fuzz-r-'));
  try {
    ensureWorkspace(dir);
    const s = structuredClone(base); s.id = 'FZ-' + i; s.name = pick(['<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', '[x](javascript:alert(1))', '|| injected |', '`x`', '<svg/onload=alert(1)>']); s.tools[0].name = s.name;
    registerSystem(dir, s);
    const a = assessSystem(dir, s.id); const h = renderHtml(a); fuzz.rendererCases++;
    if (/<img src=x|<script>alert|<svg\/onload/.test(h)) fuzz.rendererEscapeFailures++;
    renderMarkdown(a);
  } catch { fuzz.rendererEscapeFailures++; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
fs.writeFileSync(path.join(OUT, 'fuzz-results.json'), JSON.stringify(fuzz, null, 2) + '\n');

// 3. CLI transcripts (real stdout)
const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'govsut-proof-'));
const sh = (name, args, cwd = ROOT) => { const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }); fs.writeFileSync(path.join(OUT, `cli-${name}.txt`), `$ governsutra ${args.join(' ')}\n${r.stdout}${r.stderr ? '\n[stderr]\n' + r.stderr : ''}\n[exit ${r.status}]\n`); return r; };
sh('version', ['version']);
sh('doctor', ['doctor', '--root', tmpWs]);
sh('register', ['register', '--root', tmpWs, '--input', path.join(ROOT, 'fixtures/sample-system.json')]);
sh('assess-markdown', ['assess', '--root', tmpWs, '--id', 'AI-SYS-001', '--format', 'md']);
sh('scan', ['scan', '--root', tmpWs, '--repo', path.join(ROOT, 'fixtures/sample-repo')]);
sh('import-manifests', ['import-manifests', '--root', tmpWs, '--repo', path.join(ROOT, 'fixtures/sample-repo')]);
sh('audit-verify', ['audit', 'verify', '--root', tmpWs]);
sh('install-dry-run', ['install-ide', '--host', 'cursor', '--target', path.join(tmpWs, 'ide'), '--dry-run']);
sh('refusal-unknown-host', ['install-ide', '--host', '../x', '--target', path.join(tmpWs, 'ide2')]);
sh('refusal-missing-id', ['assess', '--root', tmpWs]);
fuzz.auditChainAfterDemo = verifyAudit(tmpWs).valid;
fs.rmSync(tmpWs, { recursive: true, force: true });

// 4. Sample audit report
const audit = await runAudit();
const sample = path.join(OUT, 'audit-sample');
fs.mkdirSync(sample, { recursive: true });
const f = formats(audit);
fs.writeFileSync(path.join(sample, 'audit-report.json'), f.json); fs.writeFileSync(path.join(sample, 'audit-report.md'), f.md); fs.writeFileSync(path.join(sample, 'audit-report.html'), f.html);

// 5. Environment + sums
const env = { version: VERSION, node: process.version, platform: `${process.platform}/${process.arch}`, os: `${os.type()} ${os.release()}`, recordedAt: new Date().toISOString(), tests, pass, fail, skipped, auditChecks: audit.assurance.total, auditPassed: audit.assurance.passed, auditSkipped: audit.assurance.skipped, auditFailed: audit.assurance.failed, verdict: audit.verdict };
fs.writeFileSync(path.join(OUT, 'environment.json'), JSON.stringify(env, null, 2) + '\n');
const sums = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name !== 'SHA256SUMS.txt') sums.push(`${sha256(fs.readFileSync(p))}  ${path.relative(OUT, p).split(path.sep).join('/')}`); } };
walk(OUT);
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), sums.sort((a, b) => a.split('  ')[1].localeCompare(b.split('  ')[1])).join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'README.md'), `# Proof artifacts\n\nMachine-generated by \`npm run proof\` on ${env.recordedAt} (Node ${env.node}, ${env.platform}). Nothing here is hand-edited.\n\n| File | What it is |\n|---|---|\n| test-run.tap | Raw TAP output of the full test suite (${tests} tests, ${pass} passed, ${fail} failed, ${skipped} skipped) |\n| fuzz-results.json | Deterministic fuzzing: ${fuzz.systemCases} system records, ${fuzz.scanCases} hostile manifest sets, ${fuzz.rendererCases} injection renders |\n| cli-*.txt | Real stdout/stderr and exit codes of CLI commands, including refusals |\n| audit-sample/ | The independent-style audit report (JSON, Markdown, HTML), sealed with SHA-256 |\n| environment.json | Versions and counts for this run |\n| SHA256SUMS.txt | Digests of every file above (detects change; not a signature) |\n\nVerify: \`sha256sum -c SHA256SUMS.txt\` inside this folder, and \`governsutra verify --report audit-sample/audit-report.json\`.\n\nThese results prove the code behaved as listed on this host. They do not prove legal compliance, safety, or behavior on other hosts.\n`);
console.log(JSON.stringify({ tests, pass, fail, skipped, fuzz: { systemCases: fuzz.systemCases, unexpected: fuzz.unexpectedExceptions, invariantViolations: fuzz.invariantViolations, scanUnexpected: fuzz.scanUnexpected, rendererEscapeFailures: fuzz.rendererEscapeFailures }, audit: audit.verdict }, null, 2));
if (fail || fuzz.unexpectedExceptions || fuzz.invariantViolations || fuzz.scanUnexpected || fuzz.rendererEscapeFailures || audit.verdict === 'ASSURANCE_CHECKS_FAILED') process.exitCode = 2;
