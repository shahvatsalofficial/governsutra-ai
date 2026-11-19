import { safeId } from './util.mjs';
import { CONTROL_STATUSES } from './policy.mjs';

export const LIFECYCLES = ['draft', 'in-review', 'active', 'suspended', 'retired'];
const isArr = Array.isArray;
const isObj = (v) => v && typeof v === 'object' && !isArr(v);

export function validateSystem(s) {
  const errors = [];
  if (!isObj(s)) return ['system must be an object'];
  for (const k of ['id', 'name', 'intendedUse', 'owner', 'riskOwner']) if (typeof s[k] !== 'string' || !s[k].trim()) errors.push(`${k} is required`);
  if (s.id && !safeId(s.id)) errors.push('id must be 2-80 safe characters');
  for (const k of ['dataSources', 'humanCheckpoints', 'prohibitedUses', 'models', 'tools']) if (!isArr(s[k])) errors.push(`${k} must be an array (use [] to declare none)`);
  for (const k of ['controls', 'exceptions', 'affectedPeople']) if (s[k] !== undefined && !isArr(s[k])) errors.push(`${k} must be an array`);
  if (s.lifecycle && !LIFECYCLES.includes(s.lifecycle)) errors.push('lifecycle must be draft, in-review, active, suspended or retired');
  if (s.nextReviewAt !== undefined && !Number.isFinite(Date.parse(s.nextReviewAt))) errors.push('nextReviewAt must be an ISO date');
  for (const c of isArr(s.controls) ? s.controls : []) {
    if (!isObj(c)) { errors.push('each control must be an object'); continue; }
    if (c.status !== undefined && !CONTROL_STATUSES.includes(c.status)) errors.push(`control ${c.id || c.name || '?'} has invalid status ${JSON.stringify(c.status)}`);
  }
  if (s.risk !== undefined) {
    const r = s.risk;
    if (!isObj(r)) errors.push('risk must be an object');
    else {
      if (r.decisionImpact !== undefined && (!Number.isInteger(r.decisionImpact) || r.decisionImpact < 1 || r.decisionImpact > 5)) errors.push('risk.decisionImpact must be integer 1-5');
      if (r.modelOpacity !== undefined && (!Number.isInteger(r.modelOpacity) || r.modelOpacity < 1 || r.modelOpacity > 5)) errors.push('risk.modelOpacity must be integer 1-5');
      if (r.autonomy !== undefined && !['none', 'assist', 'partial', 'automated'].includes(r.autonomy)) errors.push('risk.autonomy must be none, assist, partial or automated');
      if (r.dataSensitivity !== undefined && !['public', 'internal', 'confidential', 'sensitive', 'unknown'].includes(r.dataSensitivity)) errors.push('risk.dataSensitivity is invalid');
      if (r.exposure !== undefined && !['internal', 'external', 'unknown'].includes(r.exposure)) errors.push('risk.exposure is invalid');
      if (r.humanOversight !== undefined && !['documented', 'partial', 'unknown'].includes(r.humanOversight)) errors.push('risk.humanOversight is invalid');
    }
  }
  return errors;
}

const MAPS = {
  autonomy: { none: 1, assist: 2, partial: 4, automated: 5 },
  dataSensitivity: { public: 1, internal: 2, confidential: 3, sensitive: 5, unknown: 3 },
  exposure: { internal: 1, external: 5, unknown: 3 },
  humanOversight: { documented: 1, partial: 3, unknown: 5 }
};
const WEIGHTS = { decisionImpact: 25, autonomy: 20, dataSensitivity: 20, exposure: 15, modelOpacity: 10, humanOversight: 10 };
const LABELS = { decisionImpact: 'Decision impact', autonomy: 'System autonomy', dataSensitivity: 'Data sensitivity', exposure: 'Deployment exposure', modelOpacity: 'Model transparency gap', humanOversight: 'Human oversight gap' };

function factors(r) {
  const val = (k) => {
    if (k === 'decisionImpact' || k === 'modelOpacity') return Number.isInteger(r[k]) ? r[k] : 3;
    return MAPS[k][r[k]] ?? 3;
  };
  const unk = (k) => (k === 'decisionImpact' || k === 'modelOpacity' ? !Number.isInteger(r[k]) : !r[k] || r[k] === 'unknown');
  return Object.keys(WEIGHTS).map((key) => ({ key, label: LABELS[key], weight: WEIGHTS[key], value: val(key), unknown: unk(key) }));
}
const total = (fs) => Math.round(fs.reduce((a, f) => a + (f.value / 5) * f.weight, 0));
const bandOf = (n) => (n < 25 ? 'low' : n < 50 ? 'moderate' : n < 75 ? 'high' : 'critical');

// Transparent weighted indicator, version risk-model/1.0. Unknown inputs use mid-scale (3), never low, and are flagged.
// sensitivity shows the score if each factor were at its minimum (1) or maximum (5), so reviewers see which assumption matters.
export function computeRisk(s) {
  const r = s.risk || {};
  const fs = factors(r);
  const score = total(fs);
  const sensitivity = fs.map((f) => ({
    key: f.key, label: f.label, unknown: f.unknown, scoreIfMin: total(fs.map((g) => (g.key === f.key ? { ...g, value: 1 } : g))), scoreIfMax: total(fs.map((g) => (g.key === f.key ? { ...g, value: 5 } : g)))
  }));
  return {
    model: 'risk-model/1.0', score, band: bandOf(score),
    interpretation: 'Internal prioritization indicator only; not a legal category, certification or safety determination.',
    missingDataBehavior: 'Unknown inputs are scored 3 of 5 (mid-scale) and listed in unknownFactors; they are never treated as low.',
    unknownFactors: fs.filter((f) => f.unknown).map((f) => f.key), factors: fs, sensitivity
  };
}

export function completeness(s) {
  const checks = [['intendedUse', !!s.intendedUse], ['owner', !!s.owner], ['riskOwner', !!s.riskOwner], ['modelOrExplicitNone', isArr(s.models)], ['toolInventoryOrExplicitNone', isArr(s.tools)], ['dataSources', isArr(s.dataSources) && s.dataSources.length > 0], ['humanCheckpoints', isArr(s.humanCheckpoints) && s.humanCheckpoints.length > 0], ['prohibitedUses', isArr(s.prohibitedUses) && s.prohibitedUses.length > 0], ['reviewDate', !!s.nextReviewAt]];
  const done = checks.filter((x) => x[1]).length;
  return { score: Math.round((done / checks.length) * 100), completed: done, total: checks.length, missing: checks.filter((x) => !x[1]).map((x) => x[0]) };
}
