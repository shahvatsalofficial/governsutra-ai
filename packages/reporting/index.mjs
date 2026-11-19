import { esc, markdownSafe, verifySeal } from '../core/util.mjs';
import { VERSION } from '../core/version.mjs';

const TAGLINE = 'Know the system. Trace the evidence. Keep humans accountable.';
const DISCLAIMER = 'This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety.';

const TITLES = { 'governsutra.assessment.v2': 'System Assessment', 'governsutra.audit.v1': 'Independent Audit Report', 'governsutra.diff.v1': 'Change Diff' };
const list = (a) => (a && a.length ? a.join('; ') : 'none');

// One neutral block list feeds both renderers so Markdown and HTML always agree.
export function blocks(r) {
  const b = [];
  const sealed = r.evidence ? (verifySeal(r) ? `SHA-256 seal verified (${r.evidence.sha256.slice(0, 16)}…)` : 'SEAL MISMATCH: content changed after sealing') : 'unsealed (assessments are sealed only inside audit reports)';
  switch (r.schema) {
    case 'governsutra.assessment.v2': {
      b.push({ t: 'verdict', v: r.decision, note: 'Automated checks never approve a system, an exception or a release. A named human owner decides.' });
      b.push({ t: 'meta', rows: [['System', `${r.systemName} (${r.systemId})`], ['Lifecycle', r.lifecycle], ['Generated', r.generatedAt], ['Review scope', r.scope.boundary], ['Data cutoff (record last updated)', r.scope.dataCutoff ?? 'unknown'], ['Record provenance', r.scope.provenance.kind], ['Internal risk indicator', `${r.risk.score}/100 (${r.risk.band}) — ${r.risk.model}`], ['Inventory completeness', `${r.completeness.score}% (${r.completeness.completed}/${r.completeness.total})`], ['Unknown risk inputs', list(r.risk.unknownFactors)]] });
      b.push({ t: 'h', x: 'Policy rules (pass, fail, unknown, not-applicable, exception-approved)' }, { t: 'table', head: ['Rule', 'Title', 'Severity', 'Status', 'Reason'], rows: r.rules.map((x) => [x.id, x.title, x.severity, x.status, x.reason]) });
      b.push({ t: 'h', x: 'Risk factors and assumptions' }, { t: 'table', head: ['Factor', 'Value (1-5)', 'Weight %', 'Known?', 'Score if 1', 'Score if 5'], rows: r.risk.factors.map((f) => { const s = r.risk.sensitivity.find((x) => x.key === f.key); return [f.label, f.value, f.weight, f.unknown ? 'UNKNOWN' : 'declared', s.scoreIfMin, s.scoreIfMax]; }) });
      b.push({ t: 'note', x: r.risk.missingDataBehavior });
      b.push({ t: 'h', x: 'Models, tools and data sources (owner declarations)' });
      b.push({ t: 'table', head: ['Kind', 'Name', 'Version / sensitivity', 'Detail'], rows: [...r.components.models.map((m) => ['model', `${m.provider ?? ''} ${m.name ?? ''}`.trim(), m.version ?? 'unknown', m.deployment ?? '']), ...r.components.tools.map((t) => ['tool', t.name, t.version ?? 'unknown', (t.permissions || []).join(', ') || 'permissions not declared']), ...r.components.dataSources.map((d) => ['data', d.name, d.sensitivity ?? 'unknown', `${d.category ?? ''} · retention ${d.retention ?? 'unknown'}`])] });
      b.push({ t: 'h', x: 'Control status' }, { t: 'table', head: ['Control', 'Name', 'Status', 'Evidence refs'], rows: r.controls.length ? r.controls.map((c) => [c.id ?? '-', c.name ?? '-', c.status, c.evidenceIds.length]) : [['-', 'no controls declared', 'unknown', 0]] });
      b.push({ t: 'h', x: 'Evidence references (digest only, content never copied)' }, { t: 'table', head: ['ID', 'Kind', 'Path', 'SHA-256', 'Recorded', 'Expires'], rows: r.evidence.length ? r.evidence.map((e) => [e.id, e.kind, e.relativePath, e.sha256, e.recordedAt, e.expiresAt ?? 'none']) : [['-', '-', 'no evidence attached', '-', '-', '-']] });
      b.push({ t: 'h', x: 'Exceptions' }, { t: 'table', head: ['ID', 'Rule', 'State', 'Approver', 'Expires'], rows: r.exceptions.length ? r.exceptions.map((e) => [e.id ?? '-', e.ruleId ?? '-', e.state, e.approver ?? '-', e.expiresAt ?? '-']) : [['-', '-', 'none recorded', '-', '-']] });
      b.push({ t: 'h', x: 'Unknowns' }, { t: 'list', items: r.unknowns.length ? r.unknowns : ['none recorded (this does not mean nothing is unknown)'] });
      b.push({ t: 'h', x: 'Recommended owner actions' }, { t: 'list', items: r.recommendedActions.length ? r.recommendedActions : ['none generated; human review is still required'] });
      b.push({ t: 'h', x: 'Limitations' }, { t: 'list', items: [...r.limitations, r.disclaimer] });
      break;
    }
    case 'governsutra.diff.v1':
      b.push({ t: 'verdict', v: r.decision, note: r.note });
      b.push({ t: 'meta', rows: [['Kind', r.kind], ['Changes', String(r.changeCount)], ['Re-review triggers', list(r.reReviewTriggers)]] });
      b.push({ t: 'h', x: 'Changes' }, { t: 'table', head: ['Area', 'Change', 'Item', 'Before', 'After'], rows: r.changes.length ? r.changes.map((c) => [c.area, c.kind, c.key, typeof c.before === 'object' ? JSON.stringify(c.before) : c.before ?? '-', typeof c.after === 'object' ? JSON.stringify(c.after) : c.after ?? '-']) : [['-', 'none', '-', '-', '-']] });
      break;
    case 'governsutra.audit.v1':
      b.push({ t: 'verdict', v: r.verdict, note: r.verdictRule });
      b.push({ t: 'meta', rows: [['Tool', `GovernSutra AI ${r.toolVersion}`], ['Integrity', sealed], ['Recorded', r.recordedAt], ['Environment', `Node ${r.environment.node} · ${r.environment.platform}/${r.environment.arch}`], ['Assurance checks', `${r.assurance.passed} passed · ${r.assurance.failed} failed · ${r.assurance.skipped} skipped of ${r.assurance.total}`], ['Inventory', Object.entries(r.inventory).map(([k, v]) => `${k}: ${v}`).join(' · ')], ['Independence statement', r.independence]] });
      b.push({ t: 'h', x: 'Assurance checks (each runs the real code on a hostile or negative-control input)' }, { t: 'table', head: ['ID', 'Check', 'Expected', 'Observed', 'Result'], rows: r.assurance.checks.map((c) => [c.id, c.title, c.expected, c.observed, c.result]) });
      b.push({ t: 'h', x: 'Sample outputs' }, { t: 'table', head: ['Capability', 'Result'], rows: r.samples.map((s) => [s.capability, s.result]) });
      b.push({ t: 'h', x: 'Evidence tiers' }, { t: 'table', head: ['Artifact', 'Tier', 'Proves', 'Does not prove'], rows: r.evidenceTiers.map((e) => [e.artifact, e.tier, e.proves, e.doesNotProve]) });
      b.push({ t: 'h', x: 'Not tested / not claimed' }, { t: 'list', items: r.notTested });
      if (r.artifacts) b.push({ t: 'h', x: 'Artifact hashes' }, { t: 'table', head: ['File', 'SHA-256'], rows: Object.entries(r.artifacts) });
      b.push({ t: 'note', x: 'A SHA-256 seal detects change; it is not a signature and does not prove who produced the report. Only a human maintainer can approve a release.' });
      b.push({ t: 'note', x: DISCLAIMER });
      break;
    default:
      b.push({ t: 'code', x: JSON.stringify(r, null, 2) });
  }
  return b;
}

const title = (r) => `GovernSutra AI — ${TITLES[r.schema] ?? r.schema ?? 'Report'}${r.systemName ? `: ${r.systemName}` : ''}`;
const cell = (v) => markdownSafe(v);

export function renderMarkdown(r) {
  const out = [`# ${markdownSafe(title(r))}`, ''];
  for (const x of blocks(r)) {
    if (x.t === 'meta') out.push(...x.rows.map(([k, v]) => `**${k}:** ${cell(v)}  `), '');
    else if (x.t === 'verdict') out.push('> **Decision:** `' + String(x.v).replace(/`/g, '') + '` — ' + cell(x.note), '');
    else if (x.t === 'h') out.push(`## ${x.x}`, '');
    else if (x.t === 'table') out.push(`| ${x.head.join(' | ')} |`, `|${x.head.map(() => '---').join('|')}|`, ...x.rows.map((row) => `| ${row.map(cell).join(' | ')} |`), '');
    else if (x.t === 'list') out.push(...x.items.map((i) => `- ${cell(i)}`), '');
    else if (x.t === 'note') out.push(`_${cell(x.x)}_`, '');
    else out.push('```json', x.x.replaceAll('```', "'''"), '```', '');
  }
  out.push('---', `GovernSutra AI ${VERSION} · ${TAGLINE} · created by Vatsal Shah · Apache-2.0`, '', `_${cell(DISCLAIMER)}_`, '');
  return out.join('\n');
}

const CSS = `:root{--bg:#f6f7fb;--card:#fff;--ink:#16202e;--mute:#566377;--line:#dbe1ea;--brand:#3b3fa8;--ok:#13795b;--warn:#a15c00;--bad:#b3261e;--info:#245fb0}@media(prefers-color-scheme:dark){:root{--bg:#0f1220;--card:#171b2e;--ink:#e8ecf6;--mute:#a3adc4;--line:#2a3150;--brand:#9aa0ff;--ok:#4cd6a3;--warn:#f0b254;--bad:#ff8a80;--info:#8ab4ff}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1080px;margin:0 auto;padding:2rem 1rem 4rem}h1{font-size:1.6rem;margin:.2rem 0 1rem}h2{font-size:1.1rem;margin:2rem 0 .6rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}.eyebrow{letter-spacing:.08em;font-size:.75rem;color:var(--brand);font-weight:700}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.25rem;margin:1rem 0}dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem 1rem;margin:0}dt{color:var(--mute)}dd{margin:0;overflow-wrap:anywhere}.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{text-align:left;padding:.5rem .65rem;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}th{color:var(--mute);font-weight:600}th:first-child,td:first-child{white-space:nowrap}td{min-width:4.5rem}tr:last-child td{border-bottom:0}.verdict{border-left:6px solid var(--warn);font-size:1.02rem}.verdict.bad{border-color:var(--bad)}.verdict.good{border-color:var(--ok)}.verdict b{font-size:1.2rem}.pill{display:inline-block;padding:.02rem .55rem;border-radius:99px;font-size:.78rem;border:1px solid currentColor;white-space:nowrap}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.pill.bad{color:var(--bad)}.pill.info{color:var(--info)}.note{color:var(--mute);font-style:italic}pre{overflow:auto;background:var(--card);border:1px solid var(--line);padding:1rem;border-radius:8px;white-space:pre-wrap}footer{color:var(--mute);font-size:.85rem;margin-top:2rem}a:focus-visible,button:focus-visible{outline:3px solid var(--brand);outline-offset:2px}@media(max-width:640px){dl{grid-template-columns:1fr}}@media print{body{background:#fff;color:#000}.card,.scroll{break-inside:avoid}}`;
// Neutral colouring only: pass never reads as "compliant", and unknown/fail are always visible.
const OK = new Set(['pass', 'ASSURANCE_CHECKS_PASSED_HUMAN_REVIEW_REQUIRED']);
const BAD = new Set(['fail', 'SEAL MISMATCH', 'ASSURANCE_CHECKS_FAILED']);
const WARN = new Set(['unknown', 'skipped', 'HUMAN_REVIEW_REQUIRED', 'UNKNOWN', 'RE_REVIEW_RECOMMENDED_HUMAN_DECIDES', 'expired', 'invalid']);
const INFO = new Set(['not-applicable', 'exception-approved', 'NO_CHANGE_DETECTED', 'active']);
const pill = (v) => { const s = String(v); const c = OK.has(s) ? 'ok' : BAD.has(s) ? 'bad' : WARN.has(s) ? 'warn' : INFO.has(s) ? 'info' : null; return c ? `<span class="pill ${c}">${esc(s)}</span>` : esc(s); };

export function renderHtml(r) {
  const body = blocks(r).map((x) => {
    if (x.t === 'meta') return `<section class="card"><dl>${x.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`;
    if (x.t === 'verdict') { const cls = OK.has(x.v) ? 'good' : BAD.has(x.v) ? 'bad' : ''; return `<section class="card verdict ${cls}" role="status"><b>Decision: ${esc(x.v)}</b><br>${esc(x.note)}</section>`; }
    if (x.t === 'h') return `<h2>${esc(x.x)}</h2>`;
    if (x.t === 'table') return `<div class="scroll" tabindex="0" role="region" aria-label="table"><table><thead><tr>${x.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.rows.map((row) => `<tr>${row.map((c) => `<td>${pill(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (x.t === 'list') return `<ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (x.t === 'note') return `<p class="note">${esc(x.x)}</p>`;
    return `<pre>${esc(x.x)}</pre>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${esc(title(r))}</title><style>${CSS}</style></head><body><main><p class="eyebrow">GOVERNSUTRA AI · INTERNAL REVIEW AID</p><h1>${esc(title(r))}</h1>\n${body}\n<footer>GovernSutra AI ${esc(VERSION)} · ${esc(TAGLINE)} · created by Vatsal Shah · Apache-2.0<br>${esc(DISCLAIMER)}</footer></main></body></html>\n`;
}

export const renderMarkdownReport = renderMarkdown;
export const renderHtmlReport = renderHtml;
export function formats(report) { return { json: JSON.stringify(report, null, 2) + '\n', md: renderMarkdown(report), html: renderHtml(report) }; }
