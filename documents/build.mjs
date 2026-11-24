#!/usr/bin/env node
// Builds documents/html from documents/md with zero dependencies.
// Run: node documents/build.mjs   (after `npm run proof`). Scenario terminals are produced by running the real CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { esc, icon, flow, decision, bars, layers, boundary, tiers, terminal } from './site/diagrams.mjs';
import { computeRisk } from '../packages/core/index.mjs';

const HERE = import.meta.dirname, PROJECT = path.resolve(HERE, '..'), MD = path.join(HERE, 'md'), OUT = path.join(HERE, 'html');
const SITE = 'https://shahvatsalofficial.github.io/governsutra-ai/', REPO = 'https://github.com/shahvatsalofficial/governsutra-ai';
const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const env = rj(path.join(PROJECT, 'docs/proof/environment.json')), fuzz = rj(path.join(PROJECT, 'docs/proof/fuzz-results.json'));
const FUZZN = fuzz.systemCases + fuzz.scanCases + fuzz.rendererCases;
const V = {
  VERSION: env.version, NODE: env.node, PLATFORM: env.platform, RECORDED: env.recordedAt, DATE: env.recordedAt.slice(0, 10), TESTS: env.tests, PASS: env.pass, FAIL: env.fail, SKIPPED: env.skipped,
  AUDIT_CHECKS: env.auditChecks, AUDIT_PASSED: env.auditPassed, AUDIT_SKIPPED: env.auditSkipped, AUDIT_FAILED: env.auditFailed, VERDICT: env.verdict,
  FUZZ: FUZZN, CRASHED: fuzz.unexpectedExceptions + fuzz.invariantViolations + fuzz.scanUnexpected + fuzz.rendererEscapeFailures
};
const sub = (t) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in V)) throw new Error('Unknown placeholder ' + k); return String(V[k]); });
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- real CLI runs for the scenarios ----------
const CLI = path.join(PROJECT, 'packages/cli/index.mjs'), FX = (p) => path.join(PROJECT, 'fixtures', p);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-docs-'));
const cli = (args, cwd = tmp) => { const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const sample = rj(FX('sample-system.json'));
const wfile = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify(obj, null, 2)); return f; };
const ws = path.join(tmp, 'ws');
const rules = (id, extra = []) => { const r = cli(['assess', '--root', ws, '--id', id, '--format', 'json', ...extra]); return JSON.parse(r.out); };
const ruleLines = (a, only) => a.rules.filter((r) => !only || only.includes(r.id)).map((r) => `${r.id}  ${r.status.padEnd(18)} ${r.reason.length > 70 ? r.reason.slice(0, 67) + '...' : r.reason}`);
const SCN = {};

// S1: a pull request adds AI to a repository
const r1 = cli(['scan', '--root', ws, '--repo', FX('sample-repo'), '--out', path.join(tmp, 'scan.json')]);
const scan = rj(path.join(tmp, 'scan.json'));
SCN.s1 = ['$ governsutra scan --repo ./my-app', ...scan.candidates.map((c) => `${c.type.padEnd(24)} ${c.name.padEnd(28)} ${String(c.version).padEnd(8)} ${c.source}${c.pointer ? '#' + c.pointer : ''}`), '', `${scan.candidates.length} candidates, ${scan.manifests.length} owner manifest(s). Notes:`, ...scan.notes.map((n) => '  ' + n), 'exit code: ' + r1.code];

// S2: an auditor asks "show me the evidence"
cli(['register', '--root', ws, '--input', FX('sample-system.json')]);
const a2 = rules('AI-SYS-001');
SCN.s2 = ['$ governsutra assess --id AI-SYS-001', `risk indicator: ${a2.risk.score}/100 (${a2.risk.band}), internal prioritization only`, ...ruleLines(a2), `decision: ${a2.decision}`];

// S3: a model version bump
const bumped = structuredClone(sample); bumped.models[0].version = '2027-01-15'; bumped.tools[0].permissions.push('write:tickets');
const r3 = cli(['diff', '--a', FX('sample-system.json'), '--b', wfile('after.json', bumped)]);
const d3 = JSON.parse(r3.out);
SCN.s3 = ['$ governsutra diff --a last-quarter.json --b today.json', ...d3.changes.map((c) => `${c.area.padEnd(8)} ${c.kind.padEnd(8)} ${c.key}  fields: ${(c.changedFields || []).join(', ')}`), 'triggers: ' + d3.reReviewTriggers.join(', '), 'decision: ' + d3.decision];

// S4: evidence quietly changes
fs.writeFileSync(path.join(ws, 'model-card.md'), 'Model card v1: intended use, limits, evaluation summary.\n');
cli(['evidence', 'add', '--root', ws, '--id', 'AI-SYS-001', '--file', 'model-card.md', '--kind', 'model-card', '--verifier', 'Jane Reviewer']);
const ok4 = cli(['evidence', 'verify', '--root', ws]);
fs.writeFileSync(path.join(ws, 'model-card.md'), 'Model card v2: limits section quietly removed.\n');
const bad4 = cli(['evidence', 'verify', '--root', ws]);
const st = (r) => JSON.parse(r.out).map((e) => `${e.relativePath}  ${e.state}`);
SCN.s4 = ['$ governsutra evidence add --id AI-SYS-001 --file model-card.md --verifier "Jane Reviewer"', '$ governsutra evidence verify', ...st(ok4), 'exit code: ' + ok4.code, '', '# someone edits the model card', '$ governsutra evidence verify', ...st(bad4).map((l) => l.replace('digest-changed', 'digest-changed  <- FAIL')), 'exit code: ' + bad4.code];

// S5: exceptions: human, agent, expired
const mk = (id, ex) => ({ ...structuredClone(sample), id, humanCheckpoints: [], exceptions: ex ? [ex] : [] });
const exb = { id: 'EX-1', ruleId: 'GOV-006', rationale: 'Pilot reviewed daily by the support lead', scope: 'staging only' };
cli(['register', '--root', ws, '--input', wfile('s-human.json', mk('PILOT-HUMAN', { ...exb, approver: { name: 'Priya Nair', type: 'human' }, expiresAt: '2099-01-31' }))]);
cli(['register', '--root', ws, '--input', wfile('s-agent.json', mk('PILOT-AGENT', { ...exb, approver: { name: 'governsutra-prime', type: 'agent' }, expiresAt: '2099-01-31' }))]);
cli(['register', '--root', ws, '--input', wfile('s-old.json', mk('PILOT-EXPIRED', { ...exb, approver: { name: 'Priya Nair', type: 'human' }, expiresAt: '2025-01-31' }))]);
const g6 = (id) => ruleLines(rules(id), ['GOV-006'])[0].replace('GOV-006  ', '').slice(0, 96);
SCN.s5 = ['# no human checkpoint documented, three different exceptions', '$ governsutra assess --id PILOT-HUMAN', '  GOV-006 ' + g6('PILOT-HUMAN'), '$ governsutra assess --id PILOT-AGENT   # approver type: agent', '  GOV-006 ' + g6('PILOT-AGENT'), '$ governsutra assess --id PILOT-EXPIRED   # expired 2025-01-31', '  GOV-006 ' + g6('PILOT-EXPIRED')];

// S6: the audit log is edited
const ap = path.join(ws, '.governsutra/audit.jsonl');
const pre = cli(['audit', 'verify', '--root', ws]);
const ev = fs.readFileSync(ap, 'utf8').split('\n').filter(Boolean); const e0 = JSON.parse(ev[1]); e0.entityId = 'SOMETHING-ELSE'; ev[1] = JSON.stringify(e0); fs.writeFileSync(ap, ev.join('\n') + '\n');
const post = cli(['audit', 'verify', '--root', ws]); const pj = JSON.parse(post.out);
SCN.s6 = ['$ governsutra audit verify', `valid: ${JSON.parse(pre.out).valid}   events: ${JSON.parse(pre.out).eventCount}   (exit ${pre.code})`, '', '# someone rewrites one entry in audit.jsonl', '$ governsutra audit verify', `valid: ${pj.valid} (exit ${post.code})`, ...pj.issues.map((i) => `  line ${i.line}: ${i.reason}  <- FAIL`)];

// S7: the audit report is edited
const ro = path.join(tmp, 'rep'); cli(['audit', '--out', ro, '--quiet']);
const good = cli(['verify', '--report', path.join(ro, 'audit-report.json')]);
const rep = rj(path.join(ro, 'audit-report.json')); rep.assurance.failed = 0; rep.assurance.checks[3].result = 'pass'; rep.verdict = 'APPROVED'; fs.writeFileSync(path.join(ro, 'edited.json'), JSON.stringify(rep));
const bad7 = cli(['verify', '--report', path.join(ro, 'edited.json')]);
SCN.s7 = ['$ governsutra verify --report audit-report.json', `sealValid: ${JSON.parse(good.out).sealValid}   (exit ${good.code})`, '', '# someone edits the verdict to "APPROVED"', '$ governsutra verify --report audit-report.json', `sealValid: ${JSON.parse(bad7.out).sealValid} FAIL  (exit ${bad7.code})`];
SCN.hero = SCN.s2.slice(0, 8).map((l) => (l.length > 64 ? l.slice(0, 61) + '...' : l));
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- figures ----------
const risk = computeRisk(sample);
const statusCount = (s) => a2.rules.filter((r) => r.status === s).length;
const FIG = {
  proof: () => bars([
    { label: 'Automated tests passing', value: V.PASS, total: V.TESTS, k: 'ok' },
    { label: 'Assurance checks passing (rest skipped)', value: V.AUDIT_PASSED, total: V.AUDIT_CHECKS, k: 'ok', text: `${V.AUDIT_PASSED} / ${V.AUDIT_CHECKS} (${V.AUDIT_SKIPPED} skipped)` },
    { label: 'Fuzz inputs without failure', value: V.FUZZ - V.CRASHED, total: V.FUZZ, k: 'ok', text: `${(V.FUZZ - V.CRASHED).toLocaleString('en-US')} / ${V.FUZZ.toLocaleString('en-US')}` }
  ], `Measured ${V.DATE} on Node ${V.NODE}. Reproduce with npm run proof.`),
  weights: () => bars(risk.factors.map((f) => ({ label: f.label, value: f.weight, total: 25, k: '', text: f.weight + '%' })), 'Risk indicator weights (risk-model/1.0). Internal prioritization only, never a legal category.'),
  sensitivity: () => bars(risk.sensitivity.map((s) => ({ label: s.label, value: s.scoreIfMax - s.scoreIfMin, total: 40, k: 'warn', text: `${s.scoreIfMin} to ${s.scoreIfMax}` })), `Score range if one factor alone were at its minimum or maximum (demo system scores ${risk.score}). A longer bar means that assumption matters more.`),
  ruleStatus: () => bars([['pass', 'ok'], ['unknown', 'warn'], ['fail', 'bad'], ['not-applicable', '']].map(([s, k]) => ({ label: s, value: statusCount(s), total: 10, k, text: String(statusCount(s)) })), 'Rule statuses for the bundled demo system (10 rules). Unknown is never counted as a pass.')
};
const DIA = {
  pipeline: () => flow([{ t: 'Declare', s: 'owner JSON or manifest', k: 'brand' }, { t: 'Discover', s: 'scan allowlisted files' }, { t: 'Evaluate', s: '10 rules + risk' }, { t: 'Report', s: 'MD · HTML · JSON', k: 'ok' }, { t: 'Human decides', s: 'approve, fix, accept', k: 'warn' }], 'From declarations to a human decision'),
  decision: () => decision([
    { q: 'Does the rule have a subject?', s: 'e.g. GOV-009 needs a tool', on: 'no', out: 'NOT-APPLICABLE', k: 'neutral' },
    { q: 'Is the requirement unmet?', s: 'a valid human exception may cover it', on: 'yes', out: 'FAIL', k: 'bad' },
    { q: 'Is evidence missing or stale?', s: 'absent, expired, unverifiable', on: 'yes', out: 'UNKNOWN', k: 'warn' }], 'PASS (declared or verified)', 'How one rule gets its status'),
  chain: () => flow([{ t: 'GENESIS', s: 'prevHash of event 1', k: 'neutral' }, { t: 'Event 1', s: 'hash = SHA-256(event)', k: 'brand' }, { t: 'Event 2', s: 'prevHash = hash 1', k: 'brand' }, { t: 'Edit one entry', s: 'every later link breaks', k: 'bad' }], 'Each audit event commits to the one before it'),
  ci: () => flow([{ t: 'Pull request', s: 'adds an AI SDK', k: 'brand' }, { t: 'scan', s: 'candidates + pointers' }, { t: 'diff', s: 're-review triggers' }, { t: 'evidence verify', s: 'exit 2 on drift', k: 'warn' }, { t: 'audit', s: 'sealed report kept', k: 'ok' }], 'Governance checks in a CI pipeline')
};
const rulesTable = () => {
  const cls = { pass: 'ok', fail: 'bad', unknown: 'warn', 'not-applicable': 'info', 'exception-approved': 'info' };
  return `<div class="tw"><table><thead><tr><th>Rule</th><th>Status</th><th>Reason</th></tr></thead><tbody>${a2.rules.map((r) => `<tr><td><code>${esc(r.id)}</code> ${esc(r.title)}</td><td><span class="sev ${cls[r.status]}">${esc(r.status)}</span></td><td>${esc(r.reason)}</td></tr>`).join('')}</tbody></table></div>`;
};
const HTMLF = { layers, boundary, tiers };
const BARS = { proof: FIG.proof, weights: FIG.weights, sensitivity: FIG.sensitivity, ruleStatus: FIG.ruleStatus };
function directive(l) {
  const m = l.match(/^(?:<!--\s*)?@@(\w+)(?::(\w+))?@@(?:\s*-->)?$/); if (!m) return null; const [, k, n] = m;
  if (k === 'diagram') return DIA[n](); if (k === 'html') return HTMLF[n](); if (k === 'term') return terminal(SCN[n], 'bash · real output'); if (k === 'bars') return BARS[n](); if (k === 'rules') return rulesTable();
  throw new Error('unknown directive ' + l);
}

// ---------- markdown ----------
function inline(s) {
  const codes = []; s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; }); s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    if (/^\d\d-[a-z0-9-]+(#.*)?$/.test(u)) u = u.replace(/^(\d\d-[a-z0-9-]+)/, '$1.html');
    else if (!/^(samples|test-results)\//.test(u)) u = u.replace(/\.md(#|$)/, '.html$1');
    return `<a href="${u}"${/^https?:/.test(u) ? ' rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + esc(codes[i]) + '</code>');
}
function render(md) {
  const lines = md.split('\n'), out = [], toc = []; let i = 0, first = true;
  const BRK = /^(#{1,4} |```|\||[-*] |\d+\. |> |@@|<!--)/;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) { const lang = l.slice(3).trim(), buf = []; i++; while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]); i++; out.push(`<div class="codewrap"${lang && lang !== 'text' ? ` data-lang="${esc(lang)}"` : ''}><pre><code>${esc(buf.join('\n'))}</code></pre></div>`); continue; }
    const d = directive(l.trim()); if (d !== null) { out.push(d); i++; continue; }
    const m = l.match(/^(#{1,4}) (.*)/);
    if (m) { const n = m[1].length, id = slug(m[2]); if (n === 1 && first) { first = false; out.push(`<h1>${inline(m[2])}</h1>`); i++; continue; } if (n === 2) toc.push([id, m[2].replace(/`/g, '')]); out.push(`<h${n} id="${id}">${inline(m[2])}${n < 4 ? `<a class="anc" href="#${id}" aria-label="Link to this section">#</a>` : ''}</h${n}>`); i++; continue; }
    if (l.startsWith('|') && lines[i + 1]?.match(/^\|[\s:|-]+\|$/)) { const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]); const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')); out.push(`<div class="tw"><table><thead><tr>${cells(rows[0]).map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    if (/^[-*] /.test(l)) { const it = []; while (i < lines.length && /^[-*] /.test(lines[i])) it.push(lines[i++].slice(2)); out.push('<ul>' + it.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>'); continue; }
    if (/^\d+\. /.test(l)) { const it = []; while (i < lines.length && /^\d+\. /.test(lines[i])) it.push(lines[i++].replace(/^\d+\. /, '')); out.push('<ol>' + it.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>'); continue; }
    if (l.startsWith('> ')) { const b = []; while (i < lines.length && lines[i].startsWith('> ')) b.push(lines[i++].slice(2)); out.push(`<blockquote><p>${inline(b.join(' '))}</p></blockquote>`); continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !BRK.test(lines[i])) p.push(lines[i++]); out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

// ---------- site structure ----------
const GROUPS = [
  ['Start here', ['05-user-guide', '14-real-world-scenarios', '01-executive-summary']],
  ['Concepts', ['02-functional-specification', '03-architecture', '07-evidence-model-and-rules']],
  ['Reference', ['04-technical-reference', '06-security-and-privacy', '08-test-report', '13-assurance-and-evidence']],
  ['Project', ['09-operations-and-release', '10-legal-and-governance', '11-roadmap-and-faq', '12-glossary']]
];
const ORDER = GROUPS.flatMap((g) => g[1]);
const docs = Object.fromEntries(fs.readdirSync(MD).filter((f) => f.endsWith('.md')).map((f) => { const k = f.replace('.md', ''); const raw = sub(fs.readFileSync(path.join(MD, f), 'utf8')); return [k, { k, out: k + '.html', title: raw.match(/^# (.*)/)[1], raw }]; }));
for (const k of ORDER) if (!docs[k]) throw new Error('missing doc ' + k);
for (const k of Object.keys(docs)) if (!ORDER.includes(k)) throw new Error('doc not in site structure: ' + k);
const lede = (raw) => raw.split('\n').find((l) => l && !/^(#|\||`|-|>|@@|<!--|\d\.)/.test(l))?.replace(/[*`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').slice(0, 180) ?? '';
// Clear the children, not the folder: a dev server or editor holding the directory open would make a folder delete fail on Windows.
fs.mkdirSync(OUT, { recursive: true });
for (const c of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, c), { recursive: true, force: true });
for (const d of ['md-rendered', 'test-results', 'samples']) fs.rmSync(path.join(HERE, d), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'samples/audit'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'test-results'), { recursive: true });
for (const f of ['site.css', 'site.js']) fs.copyFileSync(path.join(HERE, 'site', f), path.join(OUT, 'assets', f));
const themeJs = fs.readFileSync(path.join(HERE, 'site/theme.js'), 'utf8').replace(/\/\/.*\n/g, '\n');
const NAV = [['index.html', 'Home'], ['05-user-guide.html', 'Docs'], ['14-real-world-scenarios.html', 'Scenarios'], ['samples/index.html', 'Samples']];
const KEYWORDS = 'AI governance, AI inventory, AI risk register, AI audit trail, MCP, model governance, NIST AI RMF, ISO 42001, EU AI Act evidence, responsible AI, agent skills, CLI';
const LD = (title, desc, url) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'SoftwareApplication', name: 'GovernSutra AI', applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, macOS, Linux (Node.js 22+)', softwareVersion: V.VERSION, license: 'https://www.apache.org/licenses/LICENSE-2.0', url: SITE, codeRepository: REPO, author: { '@type': 'Person', name: 'Vatsal Shah', url: 'https://github.com/shahvatsalofficial' }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: 'Local-first AI system governance CLI with evidence-linked records, ten transparent rules and audit reports in Markdown, HTML and JSON. Not legal advice or a compliance certification.' }, { '@type': 'TechArticle', headline: title, description: desc, url, author: { '@type': 'Person', name: 'Vatsal Shah' }, dateModified: V.DATE }] })}</script>`;
function shell({ file, title, desc, body, cur, landing = false, toc = [] }) {
  const rel = file.includes('/') ? '../' : '', url = SITE + (file === 'index.html' ? '' : file);
  const nav = `<header class="nav"><div class="nav-in"><button class="icon-btn" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="side">${icon('menu', 20).replace('class="ic"', 'class="ic i-menu"')}${icon('close', 20).replace('class="ic"', 'class="ic i-close"')}</button><a class="brand" href="${rel}index.html">${icon('shield', 24)}GovernSutra AI<small>v${V.VERSION}</small></a><nav class="nav-links" aria-label="Primary">${NAV.map(([h, t]) => `<a href="${rel}${h}"${cur === h || (cur && cur !== 'index.html' && h === '05-user-guide.html' && !['14-real-world-scenarios.html', 'samples/index.html'].includes(cur)) ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav><span class="sp"></span><a class="icon-btn" href="${REPO}" rel="noopener" aria-label="GitHub repository">${icon('github', 20)}</a><button class="icon-btn" id="theme-btn" aria-label="Switch to dark theme" aria-pressed="false">${icon('moon', 20).replace('class="ic"', 'class="ic i-moon"')}${icon('sun', 20).replace('class="ic"', 'class="ic i-sun"')}</button></div></header><div class="scrim"></div>`;
  const sidebar = `<aside class="side" id="side" aria-label="Documentation"><div class="side-top">${NAV.map(([h, t]) => `<a href="${rel}${h}">${t}</a>`).join('')}</div>${GROUPS.map(([g, ks]) => `<h4>${g}</h4>${ks.map((k) => `<a href="${rel}${docs[k].out}"${cur === docs[k].out ? ' aria-current="page"' : ''}>${esc(docs[k].title)}</a>`).join('')}`).join('')}<h4>Evidence</h4><a href="${rel}samples/index.html"${cur === 'samples/index.html' ? ' aria-current="page"' : ''}>Sample reports</a><a href="${rel}llms.txt">llms.txt</a></aside>`;
  const foot = `<footer class="site"><div class="container"><div class="foot"><div><a class="brand" href="${rel}index.html">${icon('shield', 22)}GovernSutra AI</a><p>Know the system. Trace the evidence. Keep humans accountable.</p></div><div><h5>Learn</h5><a href="${rel}05-user-guide.html">User guide</a><a href="${rel}14-real-world-scenarios.html">Real-world scenarios</a><a href="${rel}07-evidence-model-and-rules.html">Evidence and rules</a><a href="${rel}11-roadmap-and-faq.html">FAQ</a></div><div><h5>Trust</h5><a href="${rel}08-test-report.html">Test report</a><a href="${rel}06-security-and-privacy.html">Security</a><a href="${rel}10-legal-and-governance.html">Legal</a><a href="${rel}samples/index.html">Sample reports</a></div><div><h5>Project</h5><a href="${REPO}" rel="noopener">GitHub</a><a href="https://www.npmjs.com/package/governsutra-ai" rel="noopener">npm</a><a href="${REPO}/releases" rel="noopener">Releases</a><a href="${REPO}/issues" rel="noopener">Issues</a></div></div><p class="legal">Apache-2.0 &middot; Created by Vatsal Shah &middot; An engineering review aid: not legal advice, not a compliance determination, not a certification. Built ${V.DATE} from ${V.TESTS} passing tests.</p></div></footer>`;
  const tocHtml = toc.length ? `<nav class="toc-r" aria-label="On this page"><strong>On this page</strong>${toc.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>` : '<div></div>';
  const main = landing ? `<main id="main">${body}</main>` : `<div class="doc">${sidebar}<main class="prose" id="main">${body}</main>${tocHtml}</div>`;
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}${title.includes('GovernSutra') ? '' : ' | GovernSutra AI'}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#ffffff"><meta property="og:type" content="website"><meta property="og:site_name" content="GovernSutra AI"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary"><meta name="author" content="Vatsal Shah"><meta name="keywords" content="${KEYWORDS}"><script>${themeJs}</script><link rel="stylesheet" href="${rel}assets/site.css">${LD(title, desc, url)}</head><body${landing ? ' class="landing"' : ''}><a class="skip" href="#main">Skip to content</a>${nav}${landing ? `<div class="doc">${sidebar}</div>` : ''}${main}${landing ? '' : '<div class="page-foot">An engineering review aid: not legal advice, not a compliance determination, not a certification.</div>'}${foot}<script src="${rel}assets/site.js" defer></script></body></html>`;
}

// doc pages
ORDER.forEach((k, i) => {
  const d = docs[k], { html, toc } = render(d.raw), prev = docs[ORDER[i - 1]], next = docs[ORDER[i + 1]];
  const grp = GROUPS.find((g) => g[1].includes(k))[0];
  const body = `<div class="crumbs"><a href="index.html">Home</a> / ${esc(grp)}</div>${html}<div class="pager">${prev ? `<a href="${prev.out}"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="nx" href="${next.out}"><small>Next</small>${esc(next.title)}</a>` : '<span></span>'}</div><div class="edit"><a href="${REPO}/edit/main/documents/md/${k}.md" rel="noopener">Edit this page on GitHub</a><a href="${REPO}/issues/new" rel="noopener">Report a problem</a></div>`;
  fs.writeFileSync(path.join(OUT, d.out), shell({ file: d.out, title: d.title, desc: lede(d.raw) || d.title, body, cur: d.out, toc }));
});

// landing
const ic = (n, c = '') => `<div class="ico ${c}">${icon(n, 24)}</div>`;
const card = (href, n, t, p, c = '') => `<a class="card" href="${href}">${ic(n, c)}<h3>${t}</h3><p>${p}</p><span class="more">Read more ${icon('arrow', 16)}</span></a>`;
const INSTALL = 'npx governsutra-ai audit --out ./governsutra-audit';
const landing = `<section class="hero"><div class="container hero-in"><div><span class="badge"><b>v${V.VERSION}</b> Apache-2.0 &middot; zero dependencies &middot; fully offline</span><h1>Know your AI systems. <span class="grad">Trace the evidence.</span></h1><p class="lead">A local-first register for AI systems: owners, models, tools, data and human checkpoints. Ten transparent rules, change detection and audit reports in Markdown, HTML and JSON. Unknown stays unknown. Humans stay accountable.</p><div class="cta"><a class="btn primary" href="05-user-guide.html">Get started ${icon('arrow', 18)}</a><a class="btn" href="14-real-world-scenarios.html">See real scenarios</a></div><div class="install"><code>${INSTALL}</code><button class="copy" type="button" data-copy="${INSTALL}" aria-label="Copy command">${icon('copy', 16)}<span class="lbl">Copy</span></button></div></div><div class="hero-term">${terminal(SCN.hero, 'bash · real output')}</div></div></section>`
  + `<section class="container" style="margin-top:-6px"><div class="stats"><div class="stat"><b>${V.PASS}/${V.TESTS}</b><span>tests passing</span></div><div class="stat"><b>${V.AUDIT_CHECKS}</b><span>hostile-input audit checks</span></div><div class="stat"><b>${V.FUZZ.toLocaleString('en-US')}</b><span>fuzz inputs, ${V.CRASHED} failures</span></div><div class="stat"><b>0</b><span>runtime dependencies</span></div></div></section>`
  + `<section class="section"><div class="container"><span class="eyebrow">How it works</span><h2>From declarations to a human decision</h2><p class="sub">You declare what a system is. The tool discovers what the repository shows, evaluates ten rules, and writes a report a reviewer can read. A person decides.</p>${DIA.pipeline()}<div class="steps"><div class="step"><h3>Register</h3><p>Describe a system in JSON or commit a manifest.</p><div class="codewrap"><pre><code>governsutra init\ngovernsutra register --input system.json\ngovernsutra scan --repo .</code></pre></div></div><div class="step"><h3>Assess</h3><p>Ten rules, each with a status and a reason.</p><div class="codewrap"><pre><code>governsutra assess --id MY-SYS --format html\ngovernsutra evidence verify</code></pre></div></div><div class="step"><h3>Prove</h3><p>Replay hostile-input checks; verify the seal.</p><div class="codewrap"><pre><code>governsutra audit --out ./audit\ngovernsutra verify --report \\\n  ./audit/audit-report.json</code></pre></div></div></div></div></section>`
  + `<section class="section alt"><div class="container"><span class="eyebrow">Why it is different</span><h2>Honest by construction</h2><p class="sub">Compliance dashboards love green badges. GovernSutra shows what is unknown, stale or unverified next to every indicator.</p><div class="grid g3">${card('07-evidence-model-and-rules.html', 'eye', 'Unknown is not pass', 'Missing, stale or unverifiable evidence is reported as unknown, never promoted to a pass.', 'warn')}${card('07-evidence-model-and-rules.html', 'users', 'Humans decide', 'Exceptions need a named human approver and an expiry. An agent approver is rejected.')}${card('14-real-world-scenarios.html', 'chain', 'Tamper-evident', 'Hash-chained audit log and sealed reports. Edit one entry and verification fails.', 'ok')}${card('05-user-guide.html', 'flag', 'Repository evidence', 'Lockfiles, MCP configs, CI actions and owner manifests with JSON pointers and file digests.')}${card('14-real-world-scenarios.html', 'diff', 'Change detection', 'Model, tool, data, owner or intended-use changes produce named re-review triggers.')}${card('06-security-and-privacy.html', 'lock', 'Private by design', 'No network, no telemetry, no API keys. .env values are never read.', 'ok')}</div></div></section>`
  + `<section class="section"><div class="container"><span class="eyebrow">Know your limits</span><h2>What the tool prepares, and what only a person decides</h2><p class="sub">This line is the product. Everything on the left is deterministic and inspectable; everything on the right stays with accountable people.</p>${boundary()}</div></section>`
  + `<section class="section alt"><div class="container"><span class="eyebrow">Transparent scoring</span><h2>A risk indicator you can interrogate</h2><p class="sub">Six weighted factors, published missing-data behavior, and a sensitivity view that shows which assumption moves the score. It is a prioritization aid, never a legal category.</p><div class="grid g2"><div>${FIG.weights()}</div><div>${FIG.sensitivity()}</div></div></div></section>`
  + `<section class="section"><div class="container"><span class="eyebrow">Real-world scenarios</span><h2>See it on situations you recognise</h2><p class="sub">Each scenario shows real CLI output generated when this site was built.</p><div class="grid g3">${card('14-real-world-scenarios.html#1-a-pull-request-quietly-adds-ai', 'gate', 'A PR quietly adds AI', 'The scan finds the SDK and MCP server with exact pointers.', 'warn')}${card('14-real-world-scenarios.html#4-evidence-changes-after-sign-off', 'file', 'Evidence changes later', 'The recorded digest no longer matches; verify exits 2.', 'warn')}${card('14-real-world-scenarios.html#7-someone-edits-the-audit-report', 'shield', 'A report gets edited', 'The seal breaks; the edit cannot pass unnoticed.', 'ok')}</div><p style="margin-top:22px"><a class="btn" href="14-real-world-scenarios.html">All seven scenarios ${icon('arrow', 18)}</a></p></div></section>`
  + `<section class="section alt"><div class="container"><span class="eyebrow">Proof</span><h2>Evidence you can reproduce</h2><p class="sub">Run <code>npm run proof</code> to regenerate everything below.</p>${FIG.proof()}<div class="honest"><h3>${icon('alert', 22)} What it does not do</h3><ul><li>It is <strong>not</strong> legal advice, a regulatory classification, a certification or proof of safety.</li><li>The audit is automated self-verification, not a third-party audit. Hashes and seals detect edits; they are not signatures.</li><li>The 20 agents and 26 skills are instruction files. Native execution inside each IDE is not verified.</li><li>No dashboard, database, SSO or MCP server yet. Those are on the roadmap and are not shown as features.</li></ul></div></div></section>`
  + `<section class="section"><div class="container"><span class="eyebrow">Documentation</span><h2>Everything in one place</h2><div class="grid g4">${ORDER.map((k) => `<a class="card" href="${docs[k].out}"><h3>${esc(docs[k].title)}</h3><p>${esc(lede(docs[k].raw).slice(0, 95))}…</p></a>`).join('')}</div></div></section>`
  + `<section class="section"><div class="container"><div class="band"><h2>Try it in two minutes</h2><p>Node.js 22+ is all you need. No account, no API key, no network.</p><a class="btn" href="05-user-guide.html">Open the user guide</a></div></div></section>`;
fs.writeFileSync(path.join(OUT, 'index.html'), shell({ file: 'index.html', title: 'GovernSutra AI: local-first AI governance register and audit reports', desc: 'Register AI systems, evaluate ten transparent rules, trace evidence and detect change. Audit reports in Markdown, HTML and JSON. Zero dependencies, fully offline. Not legal advice.', body: landing, cur: 'index.html', landing: true }));

// samples and test results
const proof = path.join(PROJECT, 'docs/proof'), copied = [];
for (const f of fs.readdirSync(proof)) { const p = path.join(proof, f); if (fs.statSync(p).isDirectory()) continue; if (f.startsWith('cli-')) { fs.copyFileSync(p, path.join(OUT, 'samples', f)); copied.push(f); } else if (f !== 'README.md') fs.copyFileSync(p, path.join(OUT, 'test-results', f)); }
for (const f of fs.readdirSync(path.join(proof, 'audit-sample'))) { fs.copyFileSync(path.join(proof, 'audit-sample', f), path.join(OUT, 'samples/audit', f)); }
fs.mkdirSync(path.join(OUT, 'samples/demo'), { recursive: true });
for (const f of fs.readdirSync(path.join(PROJECT, 'examples/reports/demo'))) fs.copyFileSync(path.join(PROJECT, 'examples/reports/demo', f), path.join(OUT, 'samples/demo', f));
const SD = [['audit/audit-report.html', 'Independent-style audit report', 'HTML'], ['audit/audit-report.md', 'Independent-style audit report', 'Markdown'], ['audit/audit-report.json', 'Sealed audit report', 'JSON'], ['demo/assessment.html', 'System assessment (demo system)', 'HTML'], ['demo/assessment.md', 'System assessment (demo system)', 'Markdown'], ['demo/assessment.json', 'System assessment (demo system)', 'JSON'], ['../test-results/test-run.tap', 'Raw TAP test log', 'TAP'], ['../test-results/fuzz-results.json', 'Seeded fuzz results', 'JSON'], ['../test-results/environment.json', 'Run record', 'JSON'], ['../test-results/SHA256SUMS.txt', 'Digests of every proof file', 'Text'], ...copied.map((n) => [n, 'CLI transcript with exit code', 'Text'])];
const sbody = `<div class="crumbs"><a href="../index.html">Home</a> / Evidence</div><h1>Sample reports and results</h1><p>Real output generated by GovernSutra AI v${V.VERSION} from the bundled synthetic fixtures, plus the proof run. Nothing here is hand-edited. Verify the audit report seal with <code>governsutra verify --report audit-report.json</code>.</p><div class="grid g2" style="margin-top:20px">${['audit/audit-report.html', 'demo/assessment.html'].map((n) => `<a class="card" href="${n}"><span class="chip s">Open in browser</span><h3>${SD.find((x) => x[0] === n)[1]}</h3><p>${n}</p></a>`).join('')}</div><h2>All files</h2><div class="tw"><table><thead><tr><th>File</th><th>What it is</th><th>Format</th></tr></thead><tbody>${SD.map(([n, d, f]) => `<tr><td><a href="${n}">${esc(n.replace('../', ''))}</a></td><td>${esc(d)}</td><td><span class="chip">${esc(f)}</span></td></tr>`).join('')}</tbody></table></div>`;
fs.writeFileSync(path.join(OUT, 'samples/index.html'), shell({ file: 'samples/index.html', title: 'Sample reports and results', desc: 'Real generated audit and assessment reports in HTML, Markdown and JSON, plus raw test, fuzz and CLI results.', body: sbody, cur: 'samples/index.html' }));
fs.copyFileSync(path.join(PROJECT, 'llms.txt'), path.join(OUT, 'llms.txt')); fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
const urls = ['', ...ORDER.map((k) => docs[k].out), 'samples/index.html'];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${V.DATE}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
fs.writeFileSync(path.join(HERE, 'README.md'), `# GovernSutra AI documents\n\nDocumentation set for **GovernSutra AI ${V.VERSION}**: executive, functional, architecture, technical, user guide, real-world scenarios, security, evidence and rules, test report, assurance, operations, legal, roadmap and FAQ, glossary.\n\n- Website (light default, dark toggle, responsive): ${SITE}\n- Markdown sources: \`md/\` (placeholders like \`{{TESTS}}\` are filled at build time from \`docs/proof\`)\n- Build: \`npm run proof && npm run docs:build\` writes \`html/\`. Scenario terminals are real CLI output.\n- Site engine: \`build.mjs\`, \`site/\` (CSS, JS, SVG figure helpers)\n\nProject: ${REPO}\n`);
console.log(JSON.stringify({ pages: ORDER.length + 2, samples: SD.length, out: OUT }));
