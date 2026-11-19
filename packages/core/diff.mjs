import { now, canonical } from './util.mjs';

const same = (a, b) => canonical(a) === canonical(b);
const keyOf = (area, item) => (item && typeof item === 'object' ? (item.name || item.id || item.provider || JSON.stringify(item)) : String(item));

// Compare two arrays of components by name; report added, removed and changed entries.
function diffList(area, a = [], b = [], trigger) {
  const am = new Map(a.map((x) => [keyOf(area, x), x])), bm = new Map(b.map((x) => [keyOf(area, x), x]));
  const out = [];
  for (const [k, v] of bm) {
    if (!am.has(k)) out.push({ area, kind: 'added', key: k, before: null, after: v, reReviewTrigger: trigger });
    else if (!same(am.get(k), v)) out.push({ area, kind: 'changed', key: k, before: am.get(k), after: v, changedFields: Object.keys({ ...am.get(k), ...v }).filter((f) => !same(am.get(k)?.[f], v?.[f])), reReviewTrigger: trigger });
  }
  for (const [k, v] of am) if (!bm.has(k)) out.push({ area, kind: 'removed', key: k, before: v, after: null, reReviewTrigger: trigger });
  return out;
}

// Changes that must reopen review: model, tool, data, prompt, permission, deployment, intended use, owner.
export function diffSystems(before, after) {
  const changes = [
    ...diffList('models', before.models, after.models, 'model-change-review'),
    ...diffList('tools', before.tools, after.tools, 'tool-permission-review'),
    ...diffList('dataSources', before.dataSources, after.dataSources, 'data-change-review'),
    ...diffList('prompts', before.prompts, after.prompts, 'prompt-change-review'),
    ...diffList('humanCheckpoints', before.humanCheckpoints, after.humanCheckpoints, 'human-oversight-review')
  ];
  for (const [field, trigger] of [['intendedUse', 'intended-use-review'], ['prohibitedUses', 'intended-use-review'], ['deploymentContext', 'deployment-context-review'], ['owner', 'ownership-review'], ['riskOwner', 'ownership-review'], ['risk', 'risk-reassessment'], ['lifecycle', 'lifecycle-review']]) {
    if (!same(before[field], after[field])) changes.push({ area: field, kind: 'changed', key: field, before: before[field] ?? null, after: after[field] ?? null, reReviewTrigger: trigger });
  }
  const triggers = [...new Set(changes.map((c) => c.reReviewTrigger))];
  return {
    schema: 'governsutra.diff.v1', kind: 'system', generatedAt: now(), systemId: after.id ?? before.id ?? null,
    changeCount: changes.length, changes, reReviewTriggers: triggers,
    decision: changes.length ? 'RE_REVIEW_RECOMMENDED_HUMAN_DECIDES' : 'NO_CHANGE_DETECTED',
    note: 'Re-review triggers are recommendations. A named human owner decides whether a change is material.'
  };
}

// Compare two repository scans by (type, name) and report version or source changes.
export function diffScans(before, after) {
  const k = (c) => `${c.type}:${c.name}:${c.source}`;
  const am = new Map((before.candidates || []).map((c) => [k(c), c])), bm = new Map((after.candidates || []).map((c) => [k(c), c]));
  const changes = [];
  for (const [key, c] of bm) {
    if (!am.has(key)) changes.push({ area: c.type, kind: 'added', key: c.name, source: c.source, before: null, after: c.version });
    else if (am.get(key).version !== c.version) changes.push({ area: c.type, kind: 'changed', key: c.name, source: c.source, before: am.get(key).version, after: c.version });
  }
  for (const [key, c] of am) if (!bm.has(key)) changes.push({ area: c.type, kind: 'removed', key: c.name, source: c.source, before: c.version, after: null });
  return {
    schema: 'governsutra.diff.v1', kind: 'scan', generatedAt: now(), changeCount: changes.length, changes,
    reReviewTriggers: changes.length ? ['model-change-review', 'tool-permission-review'] : [],
    decision: changes.length ? 'RE_REVIEW_RECOMMENDED_HUMAN_DECIDES' : 'NO_CHANGE_DETECTED',
    note: 'Candidates are observed repository facts. Map them to systems with an owner before acting.'
  };
}

export function diffAny(a, b) {
  const isScan = (x) => Array.isArray(x?.candidates);
  if (isScan(a) && isScan(b)) return diffScans(a, b);
  if (!isScan(a) && !isScan(b) && a && b && typeof a === 'object' && typeof b === 'object') return diffSystems(a, b);
  throw new Error('diff needs two system records or two scan results of the same kind');
}
