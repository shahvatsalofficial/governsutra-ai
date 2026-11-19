import crypto from 'node:crypto';
import path from 'node:path';

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const now = () => new Date().toISOString();
export const safeId = (s) => /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(String(s ?? ''));

// True when target is base itself or a descendant. Uses path.relative so it is correct on Windows and POSIX.
export function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Deterministic JSON: sorted keys, so a seal does not depend on property order.
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

// A seal detects change. It is not a signature and does not prove who produced the report.
export function seal(report) {
  const { evidence: _drop, ...body } = report;
  return { ...body, evidence: { algorithm: 'sha256-canonical-json', sha256: sha256(Buffer.from(canonical(body))), note: 'Detects change after sealing. Not a digital signature.' } };
}
export function verifySeal(report) {
  if (!report || !report.evidence?.sha256) return false;
  const { evidence, ...body } = report;
  return evidence.sha256 === sha256(Buffer.from(canonical(body)));
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const markdownSafe = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/[\\`*_{}\[\]()#!|<>~]/g, '\\$&');
