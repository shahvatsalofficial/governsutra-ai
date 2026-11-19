import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sha256, now, isInside } from './util.mjs';
import { validateSystem, computeRisk, completeness } from './model.mjs';
import { RULES, evaluateRules, CONTROL_STATUSES } from './policy.mjs';
import { scanRepository, loadManifests } from './scan.mjs';
import { renderMarkdownReport, renderHtmlReport } from '../reporting/index.mjs';
import { VERSION } from './version.mjs';

export { validateSystem, computeRisk, completeness, scanRepository, loadManifests, renderMarkdownReport, renderHtmlReport, RULES, evaluateRules, CONTROL_STATUSES, VERSION };
export { diffSystems, diffScans, diffAny } from './diff.mjs';
export { seal, verifySeal } from './util.mjs';

export const WORKSPACE = '.governsutra';
export const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const json = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const writeJson = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); };
const workspacePath = (root, ...parts) => path.join(path.resolve(root), WORKSPACE, ...parts);

export function defaultPolicies() { return RULES.map((r) => ({ ...r })); }

export function ensureWorkspace(root = '.') {
  const base = path.resolve(root);
  fs.mkdirSync(base, { recursive: true });
  for (const d of ['evidence', 'reports', 'scans', 'policies']) fs.mkdirSync(workspacePath(base, d), { recursive: true, mode: 0o700 });
  const registryPath = workspacePath(base, 'registry.json');
  if (!fs.existsSync(registryPath)) writeJson(registryPath, { schemaVersion: '1.0.0', createdAt: now(), updatedAt: now(), systems: [] });
  const auditPath = workspacePath(base, 'audit.jsonl');
  if (!fs.existsSync(auditPath)) fs.writeFileSync(auditPath, '', { mode: 0o600 });
  const policyPath = workspacePath(base, 'policies', 'default.json');
  if (!fs.existsSync(policyPath)) writeJson(policyPath, defaultPolicies());
  return { root: base, registryPath, auditPath, policyPath };
}

// ---- tamper-evident audit chain (hash chain; not a signature, not WORM storage) ----
const auditBody = (e) => ({ seq: e.seq, timestamp: e.timestamp, actor: e.actor, action: e.action, entityId: e.entityId, details: e.details, prevHash: e.prevHash });
function appendAudit(root, { actor = 'local-user', action, entityId = null, details = {} }) {
  const p = workspacePath(root, 'audit.jsonl');
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  const prev = lines.length ? JSON.parse(lines.at(-1)).hash : 'GENESIS';
  const e = { seq: lines.length + 1, timestamp: now(), actor, action, entityId, details, prevHash: prev };
  e.hash = sha256(Buffer.from(JSON.stringify(auditBody(e))));
  fs.appendFileSync(p, JSON.stringify(e) + '\n', { mode: 0o600 });
  return e;
}
export function verifyAudit(root = '.') {
  ensureWorkspace(root);
  const lines = fs.readFileSync(workspacePath(root, 'audit.jsonl'), 'utf8').split('\n').filter(Boolean);
  let prev = 'GENESIS';
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { issues.push({ line: i + 1, reason: 'invalid JSON' }); continue; }
    if (e.seq !== i + 1) issues.push({ line: i + 1, reason: 'sequence mismatch' });
    if (e.prevHash !== prev) issues.push({ line: i + 1, reason: 'previous hash mismatch' });
    if (e.hash !== sha256(Buffer.from(JSON.stringify(auditBody(e))))) issues.push({ line: i + 1, reason: 'event hash mismatch' });
    prev = e.hash;
  }
  return { valid: issues.length === 0, eventCount: lines.length, headHash: prev, issues, limitation: 'Hash chaining detects accidental or partial tampering; an administrator able to rewrite the entire log can recompute it. This is not a digital signature or immutable WORM storage.' };
}
export function readAudit(root = '.') {
  ensureWorkspace(root);
  return fs.readFileSync(workspacePath(root, 'audit.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ---- registry ----
export function registerSystem(root, input, actor = 'local-user') {
  ensureWorkspace(root);
  const s = { ...input };
  const errs = validateSystem(s);
  if (errs.length) throw new Error('Invalid system: ' + errs.join('; '));
  const p = workspacePath(root, 'registry.json');
  const reg = json(p, { systems: [] });
  if (reg.systems.some((x) => x.id === s.id)) throw new Error(`System already exists: ${s.id}`);
  Object.assign(s, { schemaVersion: s.schemaVersion || '1.0.0', lifecycle: s.lifecycle || 'draft', createdAt: s.createdAt || now(), updatedAt: now() });
  for (const k of ['models', 'tools', 'dataSources', 'humanCheckpoints', 'prohibitedUses', 'controls', 'exceptions']) s[k] = s[k] || [];
  reg.systems.push(s);
  reg.updatedAt = now();
  writeJson(p, reg);
  appendAudit(root, { actor, action: 'system.registered', entityId: s.id, details: { lifecycle: s.lifecycle, provenance: s.provenance?.kind || 'owner-declared' } });
  return s;
}
export function listSystems(root = '.') { ensureWorkspace(root); return json(workspacePath(root, 'registry.json'), { systems: [] }).systems; }
export function getSystem(root, id) {
  const s = listSystems(root).find((x) => x.id === id);
  if (!s) throw new Error(`Unknown system: ${id}`);
  return s;
}
export function listEvidence(root = '.') { return json(workspacePath(root, 'evidence', 'index.json'), { items: [] }).items; }

// Registers each valid, digest-consistent governance/ai-systems/*.json manifest. Existing IDs are never overwritten.
export function importManifests(root, repoRoot, actor = 'local-user') {
  ensureWorkspace(root);
  const { manifests, notes } = loadManifests(repoRoot);
  const result = { imported: [], skipped: [], rejected: [], notes };
  const existing = new Set(listSystems(root).map((s) => s.id));
  for (const m of manifests) {
    if (!m.system) { result.rejected.push({ path: m.path, status: m.status, errors: m.errors }); continue; }
    if (existing.has(m.system.id)) { result.skipped.push({ path: m.path, id: m.system.id, reason: 'already registered; use diff to review changes' }); continue; }
    registerSystem(root, { ...m.system, provenance: { kind: 'repository-manifest', path: m.path, sha256: m.sha256, digest: m.digest, confirmedByOwner: false, note: 'Owner declaration in repository; an owner must confirm before it is treated as authoritative.' } }, actor);
    existing.add(m.system.id);
    result.imported.push({ path: m.path, id: m.system.id, digest: m.digest });
  }
  return result;
}

// ---- assessment ----
export function assessSystem(root, id, at = Date.now()) {
  const s = getSystem(root, id);
  const evidence = listEvidence(root).filter((e) => e.systemId === id);
  const risk = computeRisk(s), complete = completeness(s);
  const { rules, exceptions } = evaluateRules(s, evidence, at);
  const findings = rules.filter((r) => ['fail', 'unknown', 'exception-approved'].includes(r.status)).map((r) => ({
    id: r.id, severity: r.severity, status: r.status, claim: r.reason, evidence: [], confidence: 'low-to-medium',
    limitations: 'Static registry assessment of owner declarations; owner confirmation required.', recommendedOwnerAction: r.ownerAction || 'Review with the accountable owner.'
  }));
  const unknowns = [...rules.filter((r) => r.status === 'unknown').map((r) => `${r.id}: ${r.reason}`), ...risk.unknownFactors.map((f) => `risk input ${f} is unknown`)];
  return {
    schema: 'governsutra.assessment.v2', systemId: id, systemName: s.name, lifecycle: s.lifecycle, generatedAt: new Date(at).toISOString(), toolVersion: VERSION,
    scope: { boundary: 'Registry record plus attached evidence references only. No runtime, code or data inspection.', dataCutoff: s.updatedAt || null, provenance: s.provenance || { kind: 'owner-declared' } },
    components: { models: s.models || [], tools: s.tools || [], dataSources: s.dataSources || [] },
    risk, completeness: complete, rules, findings, unknowns,
    controls: (s.controls || []).map((c) => ({ id: c.id || null, name: c.name || null, status: c.status || 'unknown', evidenceIds: c.evidenceIds || [] })),
    evidence: evidence.map((e) => ({ id: e.id, kind: e.kind, relativePath: e.relativePath, sha256: e.sha256, recordedAt: e.recordedAt, expiresAt: e.expiresAt || null, status: e.status })),
    exceptions, humanDecisions: [],
    decision: 'HUMAN_REVIEW_REQUIRED',
    recommendedActions: findings.filter((f) => f.status !== 'exception-approved').map((f) => `${f.id}: ${f.recommendedOwnerAction}`),
    limitations: ['Rules evaluate owner declarations and attached evidence references; they do not verify that declarations are true.', 'Risk score is an internal prioritization indicator, not a legal risk tier.', 'Framework mappings are informational and are not applied automatically.'],
    disclaimer: 'This is an internal engineering review aid. It is not legal advice, a regulatory classification, a compliance determination, a certification or proof of safety.'
  };
}

// ---- evidence (hash reference only; content is never copied) ----
export function addEvidence(root, { systemId, file, kind = 'general', actor = 'local-user', scope = 'project-local', expiresAt, verifier, limitations }) {
  ensureWorkspace(root);
  getSystem(root, systemId);
  const base = path.resolve(root);
  const abs = path.resolve(base, file);
  if (!isInside(base, abs) || abs === base) throw new Error('Evidence file must be inside the workspace root');
  const rel = path.relative(base, abs).split(path.sep).join('/');
  if (/(^|\/)(\.env($|\.)|secrets?|credentials?|\.ssh|\.aws)(\/|$)/i.test(rel) || /\.(pem|key|p12|pfx)$/i.test(rel)) throw new Error('Secret-like paths cannot be attached as evidence');
  if (/^\.governsutra(\/|$)/.test(rel)) throw new Error('Governance workspace state cannot be attached as evidence');
  if (expiresAt !== undefined && !Number.isFinite(Date.parse(expiresAt))) throw new Error('expiresAt must be an ISO date');
  if (!fs.existsSync(abs)) throw new Error('Evidence file not found or not a regular file');
  const st = fs.lstatSync(abs);
  if (st.isSymbolicLink()) throw new Error('Symbolic links are not accepted as evidence');
  if (!st.isFile()) throw new Error('Evidence file not found or not a regular file');
  if (!isInside(fs.realpathSync(base), fs.realpathSync(abs))) throw new Error('Evidence symlink resolves outside the workspace');
  if (st.size > MAX_EVIDENCE_BYTES) throw new Error('Evidence file exceeds 2 MiB limit');
  const bytes = fs.readFileSync(abs);
  const evidence = {
    id: `EVD-${crypto.randomUUID()}`, systemId, kind, relativePath: rel, sha256: sha256(bytes), sizeBytes: bytes.length, scope, recordedAt: now(), expiresAt: expiresAt || null,
    verifier: verifier || null, retention: 'owner-defined', limitations: limitations || 'Digest proves the file bytes at recording time; it does not validate content or authorship.', status: 'reference-hashed-not-content-validated'
  };
  const p = workspacePath(root, 'evidence', 'index.json');
  const idx = json(p, { items: [] });
  idx.items.push(evidence);
  writeJson(p, idx);
  const reg = json(workspacePath(root, 'registry.json'), { systems: [] });
  const target = reg.systems.find((x) => x.id === systemId);
  target.evidenceIds = target.evidenceIds || [];
  target.evidenceIds.push(evidence.id);
  target.updatedAt = now();
  writeJson(workspacePath(root, 'registry.json'), reg);
  appendAudit(root, { actor, action: 'evidence.added', entityId: systemId, details: { evidenceId: evidence.id, kind, sha256: evidence.sha256, relativePath: evidence.relativePath } });
  return evidence;
}

// Re-hash attached evidence and report drift, missing files and expiry. Never changes the registry.
export function verifyEvidence(root, systemId, at = Date.now()) {
  const base = path.resolve(root);
  return listEvidence(root).filter((e) => !systemId || e.systemId === systemId).map((e) => {
    const abs = path.resolve(base, e.relativePath);
    let state = 'ok';
    try {
      if (!isInside(base, abs) || fs.lstatSync(abs).isSymbolicLink()) state = 'unsafe-path';
      else if (sha256(fs.readFileSync(abs)) !== e.sha256) state = 'digest-changed';
    } catch { state = 'missing'; }
    if (state === 'ok' && e.expiresAt && Date.parse(e.expiresAt) < at) state = 'expired';
    return { id: e.id, systemId: e.systemId, relativePath: e.relativePath, state };
  });
}

export function writeReport(root, id, outDir) {
  const a = assessSystem(root, id);
  const dir = path.resolve(outDir || workspacePath(root, 'reports', id));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'assessment.json'), JSON.stringify(a, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'assessment.md'), renderMarkdownReport(a));
  fs.writeFileSync(path.join(dir, 'assessment.html'), renderHtmlReport(a));
  appendAudit(root, { action: 'assessment.reported', entityId: id, details: { riskScore: a.risk.score, decision: a.decision } });
  return { assessment: a, directory: dir };
}
