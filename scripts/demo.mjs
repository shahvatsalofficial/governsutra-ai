import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureWorkspace, registerSystem, assessSystem, scanRepository, verifyAudit, writeReport } from '../packages/core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'governsutra-demo-'));
try {
  ensureWorkspace(tmp);
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/sample-system.json'), 'utf8'));
  registerSystem(tmp, sample, 'demo-runner');
  const assessment = assessSystem(tmp, sample.id);
  const discovery = scanRepository(path.join(root, 'fixtures/sample-repo'));
  const report = writeReport(tmp, sample.id, path.join(root, 'examples/reports/demo'));
  const audit = verifyAudit(tmp);
  const tally = (s) => assessment.rules.filter((r) => r.status === s).length;
  console.log(JSON.stringify({ system: sample.id, risk: { score: assessment.risk.score, band: assessment.risk.band }, rules: { pass: tally('pass'), fail: tally('fail'), unknown: tally('unknown'), notApplicable: tally('not-applicable') }, decision: assessment.decision, repoCandidates: discovery.candidates.length, report: report.directory, auditValid: audit.valid }, null, 2));
  if (!audit.valid) process.exitCode = 2;
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
