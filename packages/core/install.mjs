import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Package root, not the caller's working directory, so `npx governsutra-ai install-ide` works from any folder.
export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED = ['agents', 'skills', 'rules', 'workflows', 'schemas'];

export function listHosts() {
  const dir = path.join(PKG_ROOT, 'adapters', 'ide');
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function walk(from, to, plan) {
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name), b = path.join(to, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) walk(a, b, plan); else plan.push([a, b]);
  }
}

// Plans every copy first and refuses if any destination exists (unless force), so a refusal never leaves a half-install.
export function installHost({ host, target, force = false, dryRun = false }) {
  if (!/^[a-z0-9-]{1,30}$/.test(String(host || ''))) throw new Error('Unsupported host adapter. See docs/IDE_COMPATIBILITY.md');
  const src = path.join(PKG_ROOT, 'adapters', 'ide', host);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) throw new Error('Unsupported host adapter. See docs/IDE_COMPATIBILITY.md');
  const dest = path.resolve(target);
  const plan = [];
  walk(src, dest, plan);
  const portable = path.join(dest, 'governsutra');
  for (const name of SHARED) walk(path.join(PKG_ROOT, name), path.join(portable, name), plan);
  plan.push([path.join(PKG_ROOT, 'AGENTS.md'), path.join(portable, 'AGENTS.md')]);
  plan.push([path.join(PKG_ROOT, 'docs', 'CLAUDE_MASTER_BUILD_PROMPT.md'), path.join(portable, 'docs', 'CLAUDE_MASTER_BUILD_PROMPT.md')]);
  const conflicts = plan.filter(([, b]) => fs.existsSync(b)).map(([, b]) => b);
  if (conflicts.length && !force) throw new Error(`Refusing to overwrite ${conflicts[0]}${conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : ''}; pass --force after review`);
  if (!dryRun) for (const [a, b] of plan) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }
  return { host, target: dest, portableAssets: portable, files: plan.length, overwrites: conflicts.length > 0 && force, dryRun, note: 'Project-local host instructions plus shared agents, skills, rules, workflows, schemas and master prompt. Native runtime behavior still depends on the host and its version.' };
}
