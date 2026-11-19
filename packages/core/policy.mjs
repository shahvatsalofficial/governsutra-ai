export const CONTROL_STATUSES = ['planned', 'implemented', 'evidence-attached', 'verified-by-named-reviewer', 'failed', 'unknown', 'not-applicable', 'exception-approved'];
export const RULE_STATUSES = ['pass', 'fail', 'unknown', 'not-applicable', 'exception-approved'];

export const RULES = [
  { id: 'GOV-001', title: 'Named accountability', severity: 'high', when: 'owner and riskOwner must be present' },
  { id: 'GOV-002', title: 'Intended use and boundaries', severity: 'high', when: 'intendedUse and prohibitedUses must be documented' },
  { id: 'GOV-003', title: 'No compliance claims', severity: 'block', when: 'automated output cannot determine legal compliance' },
  { id: 'GOV-004', title: 'Evidence provenance', severity: 'high', when: 'verified controls need source, scope, timestamp, digest and a named verifier' },
  { id: 'GOV-005', title: 'Data minimization', severity: 'block', when: 'no raw sensitive data or secrets in governance artifacts; data sources declared' },
  { id: 'GOV-006', title: 'Human decision authority', severity: 'high', when: 'human checkpoints must be documented with a role and authority' },
  { id: 'GOV-007', title: 'Version traceability', severity: 'medium', when: 'model and tool versions must be recorded or explicitly unknown' },
  { id: 'GOV-008', title: 'Risk uncertainty visible', severity: 'block', when: 'unknown must not be scored as low' },
  { id: 'GOV-009', title: 'Least privilege and tool consent', severity: 'high', when: 'tool permissions must be described' },
  { id: 'GOV-010', title: 'Lifecycle review and expiry', severity: 'medium', when: 'active systems require a review date that is not past' }
];

const present = (v) => typeof v === 'string' && v.trim().length > 0;
const isPast = (iso, at) => Number.isFinite(Date.parse(iso)) && Date.parse(iso) < at;

export function unknownRiskInputs(s) {
  const r = s.risk || {};
  const u = [];
  if (!Number.isInteger(r.decisionImpact)) u.push('decisionImpact');
  if (!r.autonomy) u.push('autonomy');
  if (!r.dataSensitivity || r.dataSensitivity === 'unknown') u.push('dataSensitivity');
  if (!r.exposure || r.exposure === 'unknown') u.push('exposure');
  if (!Number.isInteger(r.modelOpacity)) u.push('modelOpacity');
  if (!r.humanOversight || r.humanOversight === 'unknown') u.push('humanOversight');
  return u;
}

// An exception is valid only with a named HUMAN approver, rationale, scope, rule and a future expiry.
// A model or agent can never be the approver.
export function exceptionState(ex, at = Date.now()) {
  if (!ex || typeof ex !== 'object') return 'invalid';
  const a = ex.approver;
  if (!a || !present(a.name) || a.type !== 'human') return 'invalid';
  if (!present(ex.rationale) || !present(ex.scope) || !present(ex.ruleId)) return 'invalid';
  if (!Number.isFinite(Date.parse(ex.expiresAt))) return 'invalid';
  return isPast(ex.expiresAt, at) ? 'expired' : 'active';
}

// Every rule returns exactly one of pass | fail | unknown | not-applicable | exception-approved, with a reason.
// Missing, stale or unverifiable evidence is never pass.
export function evaluateRules(s, evidenceItems = [], at = Date.now()) {
  const out = [];
  const r = (rule, status, reason, ownerAction) => {
    const def = RULES.find((x) => x.id === rule);
    out.push({ id: rule, title: def.title, severity: def.severity, status, reason, ownerAction: ownerAction || null });
  };
  const evById = new Map(evidenceItems.map((e) => [e.id, e]));

  const named = present(s.owner) && present(s.riskOwner);
  r('GOV-001', named ? 'pass' : 'fail', named ? 'Owner and risk owner are named (owner declaration, not verified).' : 'Owner or risk owner is missing.', 'Assign an accountable owner and a risk owner.');
  const hasUse = present(s.intendedUse), hasProhibited = Array.isArray(s.prohibitedUses) && s.prohibitedUses.length > 0;
  r('GOV-002', hasUse && hasProhibited ? 'pass' : 'fail', hasUse && hasProhibited ? 'Intended and prohibited uses are documented (owner declaration).' : 'Intended use or prohibited uses are missing.', 'Document intended and prohibited uses.');
  r('GOV-003', 'pass', 'Engine design rule: output always requires human review and never states compliance.', null);

  const controls = Array.isArray(s.controls) ? s.controls : [];
  const verified = controls.filter((c) => c.status === 'verified-by-named-reviewer');
  const badVerified = verified.filter((c) => !c.evidenceIds?.length || !present(c.verifier) || c.evidenceIds.some((id) => !evById.has(id)));
  if (!controls.length) r('GOV-004', 'unknown', 'No controls declared, so evidence provenance cannot be assessed.', 'Declare controls and attach scoped evidence.');
  else if (badVerified.length) r('GOV-004', 'fail', `Controls marked verified without resolvable evidence or a named verifier: ${badVerified.map((c) => c.id || c.name).join(', ')}.`, 'Attach evidence references and name the verifier.');
  else {
    const stale = controls.flatMap((c) => (c.evidenceIds || []).map((id) => evById.get(id))).filter((e) => e && e.expiresAt && isPast(e.expiresAt, at));
    if (stale.length) r('GOV-004', 'unknown', `${stale.length} evidence item(s) are past expiry and are treated as unknown.`, 'Refresh or replace expired evidence.');
    else if (!verified.length) r('GOV-004', 'unknown', 'No control is verified by a named reviewer; presence of a file is not verification.', 'Have a named reviewer verify controls.');
    else r('GOV-004', 'pass', 'Verified controls resolve to hashed evidence and a named verifier.', null);
  }

  const ds = Array.isArray(s.dataSources) ? s.dataSources : [];
  const raw = ds.filter((d) => d.rawDataAttached === true);
  if (raw.length) r('GOV-005', 'fail', `Data source(s) flagged rawDataAttached: ${raw.map((d) => d.name).join(', ')}.`, 'Remove raw data; keep metadata and hashes only.');
  else if (!ds.length) r('GOV-005', 'unknown', 'Data sources are not declared.', 'Record source categories, origins, sensitivity and retention.');
  else r('GOV-005', 'pass', 'Data sources declared as metadata with no raw data attached (owner declaration).', null);

  const hc = Array.isArray(s.humanCheckpoints) ? s.humanCheckpoints : [];
  if (!hc.length) r('GOV-006', 'fail', 'No human checkpoint is documented.', 'Name reviewer roles, authority, override and escalation.');
  else if (hc.some((c) => !present(c.role) || !present(c.authority))) r('GOV-006', 'fail', 'A human checkpoint lacks a role or authority.', 'Complete role and authority for each checkpoint.');
  else r('GOV-006', 'pass', 'Human checkpoints name a role and authority (declared; actual intervention not evidenced).', null);

  const comps = [...(s.models || []), ...(s.tools || [])];
  if (!comps.length) r('GOV-007', 'not-applicable', 'No models or tools are declared.', null);
  else {
    const missing = comps.filter((c) => !present(c.version));
    r('GOV-007', missing.length ? 'unknown' : 'pass', missing.length ? `${missing.length} component(s) have no recorded version.` : 'All declared models and tools record a version.', 'Record versions or mark them explicitly unknown.');
  }

  const unknownRisk = unknownRiskInputs(s);
  r('GOV-008', unknownRisk.length ? 'unknown' : 'pass', unknownRisk.length ? `Risk inputs unknown: ${unknownRisk.join(', ')}. Unknown is scored mid-scale, never low.` : 'All risk inputs are declared.', 'Resolve unknown risk dimensions or document why they stay unknown.');

  const tools = Array.isArray(s.tools) ? s.tools : [];
  if (!tools.length) r('GOV-009', 'not-applicable', 'No tools declared.', null);
  else {
    const noPerm = tools.filter((t) => !Array.isArray(t.permissions) || !t.permissions.length);
    r('GOV-009', noPerm.length ? 'fail' : 'pass', noPerm.length ? `Tool(s) without declared permissions: ${noPerm.map((t) => t.name).join(', ')}.` : 'Every tool lists its permission scopes (declared).', 'List least-privilege scopes for each tool.');
  }

  if (s.lifecycle !== 'active' && s.lifecycle !== 'in-review') r('GOV-010', 'not-applicable', `Lifecycle is ${s.lifecycle || 'unset'}; review date is advisory.`, null);
  else if (!present(s.nextReviewAt)) r('GOV-010', 'unknown', 'No next review date recorded.', 'Set a review cadence and reviewer.');
  else if (isPast(s.nextReviewAt, at)) r('GOV-010', 'fail', `Review date ${s.nextReviewAt} has passed.`, 'Hold the periodic review and set a new date.');
  else r('GOV-010', 'pass', `Next review ${s.nextReviewAt}.`, null);

  // Active human-approved exceptions turn a fail into exception-approved; expired or invalid ones reopen it.
  const exceptions = (Array.isArray(s.exceptions) ? s.exceptions : []).map((e) => ({ id: e?.id ?? null, ruleId: e?.ruleId ?? null, state: exceptionState(e, at), expiresAt: e?.expiresAt ?? null, approver: e?.approver?.name ?? null }));
  for (const o of out) {
    if (o.status !== 'fail') continue;
    const ex = exceptions.find((e) => e.ruleId === o.id && e.state === 'active');
    if (ex) { o.status = 'exception-approved'; o.reason += ` Exception ${ex.id} approved by ${ex.approver} until ${ex.expiresAt}.`; }
    else if (exceptions.some((e) => e.ruleId === o.id && e.state === 'expired')) o.reason += ' An exception exists but has expired, so the finding is reopened.';
    else if (exceptions.some((e) => e.ruleId === o.id && e.state === 'invalid')) o.reason += ' An exception exists but is invalid (needs a named human approver, rationale, scope and future expiry).';
  }
  return { rules: out, exceptions, evaluatedAt: new Date(at).toISOString() };
}
