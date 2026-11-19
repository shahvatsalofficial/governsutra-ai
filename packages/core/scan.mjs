import fs from 'node:fs';
import path from 'node:path';
import { sha256, now, isInside, canonical } from './util.mjs';
import { validateSystem } from './model.mjs';
import { SCANNER_VERSION } from './version.mjs';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_MANIFESTS = 200;

const providerPatterns = [
  [/^openai$/i, 'OpenAI API SDK'], [/^@anthropic-ai\/sdk$/i, 'Anthropic SDK'], [/^@google\/generative-ai$/i, 'Google Generative AI SDK'], [/^@google\/genai$/i, 'Google GenAI SDK'],
  [/^langchain/i, 'LangChain ecosystem'], [/^@langchain\//i, 'LangChain ecosystem'], [/^transformers$/i, 'Hugging Face Transformers'], [/^@huggingface\//i, 'Hugging Face client'], [/^ollama$/i, 'Ollama client'],
  [/^@modelcontextprotocol\/sdk$/i, 'MCP SDK'], [/^semantic-kernel/i, 'Semantic Kernel'], [/^litellm$/i, 'LiteLLM'], [/^ai$/i, 'Vercel AI SDK'], [/^@ai-sdk\//i, 'Vercel AI SDK'], [/^llamaindex$/i, 'LlamaIndex'], [/^@mistralai\//i, 'Mistral SDK']
];
const pyPackages = [['openai', 'OpenAI SDK'], ['anthropic', 'Anthropic SDK'], ['google-generativeai', 'Google Generative AI SDK'], ['google-genai', 'Google GenAI SDK'], ['langchain', 'LangChain ecosystem'], ['llama-index', 'LlamaIndex'], ['transformers', 'Hugging Face Transformers'], ['ollama', 'Ollama client'], ['mcp', 'MCP SDK'], ['litellm', 'LiteLLM'], ['mistralai', 'Mistral SDK']];
const providerLabel = (name) => providerPatterns.find(([re]) => re.test(name))?.[1] ?? null;

export function safeVersion(v) {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9*^~<>=.|+_-]{1,80}$/.test(s) ? s : (s ? 'non-semver-or-url-redacted' : 'unknown');
}
function candidate(type, name, version, source, confidence, extra = {}) {
  return { type, name, version: safeVersion(version), source, confidence, ...extra };
}

// Reads one allowlisted file under size, symlink and containment limits. Returns {text, sha256} or null.
function readBounded(base, rel, notes, maxBytes = MAX_FILE_BYTES) {
  const p = path.join(base, rel);
  let st;
  try { st = fs.lstatSync(p); } catch { return null; }
  if (st.isSymbolicLink() || !st.isFile()) { notes.push(`${rel} skipped: not a regular non-symlink file`); return null; }
  if (!isInside(fs.realpathSync(base), fs.realpathSync(p))) { notes.push(`${rel} skipped: resolves outside repository root`); return null; }
  if (st.size > maxBytes) { notes.push(`${rel} skipped: exceeds ${maxBytes} byte limit`); return null; }
  const buf = fs.readFileSync(p);
  return { text: buf.toString('utf8'), sha256: sha256(buf) };
}

function lineOf(text, needle) {
  const i = text.indexOf(needle);
  return i < 0 ? undefined : text.slice(0, i).split('\n').length;
}

function scanPackageJson(file, found, notes) {
  try {
    const p = JSON.parse(file.text);
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(p[section] || {})) {
        const label = providerLabel(name);
        if (label) found.push(candidate('sdk-dependency', label, version, 'package.json', 'high', { pointer: `/${section}/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`, line: lineOf(file.text, `"${name}"`), sourceSha256: file.sha256, metadata: { packageName: name, declared: true } }));
      }
    }
  } catch { notes.push('package.json exists but could not be parsed'); }
}

// package-lock.json v1/v2/v3: resolved exact versions with a JSON pointer for each match.
export function parsePackageLock(file, found, notes) {
  try {
    const lock = JSON.parse(file.text);
    let n = 0;
    for (const [key, entry] of Object.entries(lock.packages || {})) {
      if (!key.includes('node_modules/')) continue;
      const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
      const label = providerLabel(name);
      if (label && entry && typeof entry === 'object') { n++; found.push(candidate('sdk-dependency-resolved', label, entry.version, 'package-lock.json', 'high', { pointer: `/packages/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, sourceSha256: file.sha256, metadata: { packageName: name, resolved: true } })); }
    }
    if (!n) {
      const walk = (deps, prefix) => { for (const [name, e] of Object.entries(deps || {})) { const label = providerLabel(name); if (label && e && typeof e === 'object') found.push(candidate('sdk-dependency-resolved', label, e.version, 'package-lock.json', 'high', { pointer: `${prefix}/${name.replace(/\//g, '~1')}`, sourceSha256: file.sha256, metadata: { packageName: name, resolved: true } })); if (e?.dependencies) walk(e.dependencies, `${prefix}/${name.replace(/\//g, '~1')}/dependencies`); } };
      walk(lock.dependencies, '/dependencies');
    }
  } catch { notes.push('package-lock.json exists but could not be parsed'); }
}

// poetry.lock and uv.lock use [[package]] blocks with name and version keys.
export function parseTomlLock(file, source, found) {
  const blocks = file.text.split(/^\[\[package\]\]\s*$/m).slice(1);
  for (const b of blocks) {
    const name = b.match(/^name\s*=\s*"([^"]{1,100})"/m)?.[1];
    const version = b.match(/^version\s*=\s*"([^"]{1,80})"/m)?.[1];
    const label = name && pyPackages.find(([p]) => p === name.toLowerCase())?.[1];
    if (label) found.push(candidate('python-dependency-resolved', label, version, source, 'high', { line: lineOf(file.text, `name = "${name}"`), sourceSha256: file.sha256, metadata: { packageName: name, resolved: true } }));
  }
}

function scanPython(file, source, found) {
  const lines = file.text.split(/\r?\n/);
  for (const [name, label] of pyPackages) {
    const idx = lines.findIndex((x) => new RegExp(`^\\s*"?${name.replace(/[-]/g, '[-_]')}(?:\\s|[=<>~!\\["]|$)`, 'i').test(x));
    if (idx < 0) continue;
    const m = lines[idx].match(/([=<>~!]{1,2})\s*([A-Za-z0-9.*+_-]+)/);
    found.push(candidate('python-dependency', label, m ? `${m[1]}${m[2]}` : 'declared', source, 'medium', { line: idx + 1, sourceSha256: file.sha256, metadata: { packageName: name } }));
  }
}

function scanMcp(file, source, found, notes) {
  try {
    const cfg = JSON.parse(file.text);
    const servers = cfg.mcpServers || cfg.servers || {};
    for (const [rawName, v] of Object.entries(servers)) {
      const name = /^[A-Za-z0-9._-]{1,80}$/.test(rawName) ? rawName : 'untrusted-server-name-redacted';
      const val = v && typeof v === 'object' ? v : {};
      found.push(candidate('mcp-server', name, 'unknown', source, 'high', {
        pointer: `/${cfg.mcpServers ? 'mcpServers' : 'servers'}/${rawName.replace(/~/g, '~0').replace(/\//g, '~1')}`, line: lineOf(file.text, JSON.stringify(rawName)), sourceSha256: file.sha256,
        metadata: { command: typeof val.command === 'string' ? path.basename(val.command) : 'unknown', transport: typeof val.url === 'string' ? 'remote-url-redacted' : 'stdio-or-unknown', environmentVariableNames: Object.keys(val.env || {}).filter((k) => /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(k)) }
      }));
    }
  } catch { notes.push(`${source} exists but could not be parsed`); }
}

// CI workflow declarations: only the presence of AI-related action names is noted, never secrets or step bodies.
function scanWorkflows(base, found, notes) {
  const dir = path.join(base, '.github', 'workflows');
  let names = [];
  try { if (fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink()) names = fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).slice(0, 50); } catch { return []; }
  const files = [];
  for (const n of names) {
    const rel = `.github/workflows/${n}`;
    const f = readBounded(base, rel, notes);
    if (!f) continue;
    files.push(rel);
    for (const m of f.text.matchAll(/^\s*-?\s*uses:\s*([A-Za-z0-9._\/-]{1,120})@/gm)) {
      if (/anthropics\/claude|openai|google-github-actions\/run-gemini|github\/copilot|codex|cursor/i.test(m[1])) found.push(candidate('ci-ai-action', m[1], 'unknown', rel, 'medium', { line: lineOf(f.text, m[0].trim()), sourceSha256: f.sha256, metadata: { note: 'CI step references an AI-related action; confirm purpose with the owner.' } }));
    }
  }
  return files;
}

export function scanRepository(repoRoot) {
  const base = path.resolve(repoRoot);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) throw new Error('Repository root must be an existing directory');
  const found = [], notes = [], files = [], digests = {};
  const take = (rel, fn) => { const f = readBounded(base, rel, notes); if (f) { files.push(rel); digests[rel] = f.sha256; fn(f); } };
  take('package.json', (f) => scanPackageJson(f, found, notes));
  take('package-lock.json', (f) => parsePackageLock(f, found, notes));
  for (const file of ['requirements.txt', 'pyproject.toml']) take(file, (f) => scanPython(f, file, found));
  for (const file of ['poetry.lock', 'uv.lock']) take(file, (f) => parseTomlLock(f, file, found));
  for (const file of ['mcp.json', '.mcp.json', '.cursor/mcp.json', '.vscode/mcp.json']) take(file, (f) => scanMcp(f, file, found, notes));
  for (const f of scanWorkflows(base, found, notes)) files.push(f);
  const manifests = loadManifests(base);
  for (const m of manifests.manifests) { files.push(m.path); digests[m.path] = m.sha256; }
  notes.push(...manifests.notes);
  for (const file of ['.env', '.env.local', '.env.production', '.env.example']) if (fs.existsSync(path.join(base, file))) notes.push(`${file} exists; its contents were deliberately not read`);
  return {
    schemaVersion: '1.1.0', scanner: SCANNER_VERSION, scannedAt: now(), rootLabel: path.basename(base), scope: 'allowlisted project manifests only',
    candidates: found, sourceFiles: files, sourceDigests: digests, manifests: manifests.manifests, notes,
    limitations: ['Best-effort candidate discovery, not a complete AI inventory.', 'Does not inspect source-code semantics, runtime traffic, model registries or cloud accounts.', 'Does not read .env values, credentials, prompts or customer records.', 'Manifest symlinks and files larger than 2 MiB are skipped.', 'Candidates are observed facts only; owner confirmation is required before a candidate becomes an authoritative system record.']
  };
}

// Owner-authored manifests: governance/ai-systems/*.json. A manifest may carry integrity.sha256 =
// SHA-256 of the canonical JSON body without the integrity field. That detects edits; it is NOT a signature.
export function loadManifests(repoRoot) {
  const base = path.resolve(repoRoot);
  const dir = path.join(base, 'governance', 'ai-systems');
  const notes = [], manifests = [];
  let names;
  try {
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink() || !st.isDirectory()) { notes.push('governance/ai-systems skipped: not a regular directory'); return { manifests, notes }; }
    names = fs.readdirSync(dir).filter((f) => /\.json$/i.test(f)).sort();
  } catch { return { manifests, notes }; }
  if (names.length > MAX_MANIFESTS) { notes.push(`governance/ai-systems has ${names.length} files; only the first ${MAX_MANIFESTS} were read`); names = names.slice(0, MAX_MANIFESTS); }
  for (const n of names) {
    const rel = `governance/ai-systems/${n}`;
    const f = readBounded(base, rel, notes);
    if (!f) { manifests.push({ path: rel, sha256: null, status: 'skipped', errors: ['unreadable, oversized, symlink or outside root'], system: null }); continue; }
    let doc;
    try { doc = JSON.parse(f.text); } catch { manifests.push({ path: rel, sha256: f.sha256, status: 'invalid-json', errors: ['not valid JSON'], system: null }); continue; }
    const { integrity, ...body } = doc && typeof doc === 'object' ? doc : {};
    let digest = 'no-digest';
    if (integrity?.sha256) digest = integrity.sha256 === sha256(Buffer.from(canonical(body))) ? 'digest-verified' : 'digest-mismatch';
    const errors = validateSystem(body);
    manifests.push({ path: rel, sha256: f.sha256, status: errors.length ? 'invalid' : digest === 'digest-mismatch' ? 'digest-mismatch' : 'valid', digest, errors, system: errors.length || digest === 'digest-mismatch' ? null : body });
  }
  return { manifests, notes };
}

export function manifestDigest(system) {
  const { integrity: _i, ...body } = system;
  return sha256(Buffer.from(canonical(body)));
}
