#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ensureWorkspace, registerSystem, listSystems, assessSystem, scanRepository, verifyAudit, readAudit, addEvidence, verifyEvidence,
  writeReport, importManifests, diffAny, verifySeal, VERSION
} from '../core/index.mjs';
import { installHost, listHosts } from '../core/install.mjs';
import { runAudit } from '../core/audit.mjs';
import { formats, renderMarkdown, renderHtml } from '../reporting/index.mjs';
import { createGovernanceServer } from '../server/index.mjs';

const BOOLEAN = new Set(['force', 'quiet', 'dry-run', 'help', 'version']);
const HELP = `GovernSutra AI ${VERSION}  (created by Vatsal Shah, Apache-2.0)
Know the system. Trace the evidence. Keep humans accountable.
Local-first. No API keys. No network. Not legal advice and never a compliance determination.

Workspace (.governsutra/ under --root, default current directory):
  init                                          create workspace, policies and empty audit chain
  register --input FILE                         register an AI system record (JSON)
  import-manifests --repo DIR                   register governance/ai-systems/*.json from a repository
  list                                          list registered systems
  assess --id ID [--format json|md|html]        evaluate GOV-001..GOV-010 (pass/fail/unknown/not-applicable)
  report --id ID [--out DIR]                    write assessment.json, .md and .html
  evidence add --id ID --file FILE [--kind K] [--expires ISO] [--verifier NAME]
  evidence verify [--id ID]                     re-hash attached evidence, report drift or expiry
  scan [--repo DIR] [--out FILE]                candidate discovery from allowlisted manifests and lockfiles
  diff --a FILE --b FILE [--format json|md|html]  system or scan change diff with re-review triggers
  audit verify                                  verify the hash-chained audit log
  audit [--out DIR] [--force] [--quiet]         independent-style assurance report (JSON + MD + HTML)
  verify --report FILE                          check the SHA-256 seal of an audit report

Integration:
  install-ide --host HOST --target DIR [--force] [--dry-run]    hosts: ${listHosts().join(', ')}
  serve [--port 4317]                           read-only loopback API (set GOVSUTRA_TOKEN, 24+ chars)
  doctor | version | help

Global: --root DIR  --actor NAME`;

export function parse(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (!x.startsWith('--')) { o._.push(x); continue; }
    const k = x.slice(2);
    if (!k) throw new Error(`Invalid argument: ${x}`);
    if (Object.hasOwn(o, k)) throw new Error(`Duplicate option: ${x}`);
    if (BOOLEAN.has(k)) { o[k] = true; continue; }
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${x}`);
    o[k] = args[++i];
  }
  return o;
}

const out = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
function emit(report, o) {
  const fmt = o.format ?? 'json';
  if (!['json', 'md', 'html'].includes(fmt)) throw new Error('--format must be json, md or html');
  out(fmt === 'md' ? renderMarkdown(report) : fmt === 'html' ? renderHtml(report) : report);
}
function readJson(file, label) {
  let t;
  try { t = fs.readFileSync(path.resolve(file), 'utf8'); } catch { throw new Error(`Cannot read ${label}: ${file}`); }
  try { return JSON.parse(t); } catch { throw new Error(`${label} is not valid JSON: ${file}`); }
}
const need = (o, k) => { if (!o[k]) throw new Error(`--${k} is required`); return o[k]; };

export async function main(argv) {
  const args = [...argv];
  const first = args[0] && !args[0].startsWith('--') ? args.shift() : null;
  const o = parse(args);
  const cmd = first ?? (o.version ? 'version' : 'help');
  const root = path.resolve(o.root || '.');
  const actor = o.actor || 'local-user';
  switch (cmd) {
    case 'help': out(HELP); break;
    case 'version': out(VERSION); break;
    case 'init': out(ensureWorkspace(root)); break;
    case 'register': ensureWorkspace(root); out(registerSystem(root, readJson(need(o, 'input'), 'input'), actor)); break;
    case 'import-manifests': out(importManifests(root, path.resolve(need(o, 'repo')), actor)); break;
    case 'list': out(listSystems(root)); break;
    case 'assess': emit(assessSystem(root, need(o, 'id')), o); break;
    case 'report': out(writeReport(root, need(o, 'id'), o.out)); break;
    case 'evidence': {
      const sub = o._.shift();
      if (sub === 'add') out(addEvidence(root, { systemId: need(o, 'id'), file: need(o, 'file'), kind: o.kind || 'general', actor, expiresAt: o.expires, verifier: o.verifier }));
      else if (sub === 'verify') { const r = verifyEvidence(root, o.id); out(r); if (r.some((x) => x.state !== 'ok')) process.exitCode = 2; }
      else throw new Error('Use: evidence add | evidence verify');
      break;
    }
    case 'scan': {
      const result = scanRepository(path.resolve(o.repo || root));
      const dest = o.out ? path.resolve(o.out) : path.join(root, '.governsutra', 'scans', 'latest.json');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, JSON.stringify(result, null, 2) + '\n');
      out({ saved: dest, candidates: result.candidates.length, manifests: result.manifests.length, notes: result.notes });
      break;
    }
    case 'diff': emit(diffAny(readJson(need(o, 'a'), '--a'), readJson(need(o, 'b'), '--b')), o); break;
    case 'audit': {
      if (o._[0] === 'verify') { const v = verifyAudit(root); out(v); if (!v.valid) process.exitCode = 2; break; }
      const report = await runAudit();
      if (o.out) {
        const dir = path.resolve(o.out);
        fs.mkdirSync(dir, { recursive: true });
        const f = formats(report);
        const files = { 'audit-report.json': f.json, 'audit-report.md': f.md, 'audit-report.html': f.html };
        for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body, { flag: o.force ? 'w' : 'wx' });
        if (!o.quiet) out({ verdict: report.verdict, passed: report.assurance.passed, failed: report.assurance.failed, skipped: report.assurance.skipped, directory: dir, files: Object.keys(files) });
      } else emit(report, o);
      if (report.verdict === 'ASSURANCE_CHECKS_FAILED') process.exitCode = 2;
      break;
    }
    case 'verify': {
      const r = readJson(need(o, 'report'), '--report');
      const ok = verifySeal(r);
      out({ sealValid: ok, note: 'A seal detects change; it is not a signature.' });
      if (!ok) process.exitCode = 2;
      break;
    }
    case 'install-ide': out(installHost({ host: need(o, 'host'), target: need(o, 'target'), force: o.force === true, dryRun: o['dry-run'] === true })); break;
    case 'serve': {
      ensureWorkspace(root);
      const port = Number(o.port || process.env.PORT || 4317);
      const token = process.env.GOVSUTRA_TOKEN;
      if (!token || token.length < 24) throw new Error('Set GOVSUTRA_TOKEN (environment variable) to a random token of at least 24 characters');
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be 1-65535');
      createGovernanceServer({ root, token }).listen(port, '127.0.0.1', () => console.log(`GovernSutra read-only API listening on http://127.0.0.1:${port}`));
      break;
    }
    case 'doctor': {
      const major = Number(process.versions.node.split('.')[0]);
      out({ tool: `governsutra-ai ${VERSION}`, node: process.version, minimum: 'v22', nodeSupported: major >= 22, platform: process.platform, workspace: root, workspaceExists: fs.existsSync(path.join(root, '.governsutra')), hostAdapters: listHosts(), offlineCore: true, runtimeDependencies: 0, networkCalls: 'none (serve binds 127.0.0.1 only)' });
      if (major < 22) process.exitCode = 1;
      break;
    }
    default: throw new Error(`Unknown command: ${cmd}. Run: governsutra help`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`GovernSutra: ${e.message}`); process.exitCode = 1; });
}
