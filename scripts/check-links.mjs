#!/usr/bin/env node
// Verifies every internal link and #anchor in documents/html resolves. Exit 2 on any broken link.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../documents/html');
const pages = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.html')) pages.push(p); } };
walk(OUT);
const ids = new Map(); const html = new Map();
for (const p of pages) { const t = fs.readFileSync(p, 'utf8'); html.set(p, t); ids.set(p, new Set([...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))); }
const bad = [];
for (const [p, t] of html) {
  for (const m of t.matchAll(/\shref="([^"]*)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|#$|data:)/.test(h) || h === '') continue;
    const [file, frag] = h.split('#');
    const target = file ? path.resolve(path.dirname(p), file) : p;
    if (!fs.existsSync(target)) { bad.push(`${path.relative(OUT, p)} -> ${h} (missing file)`); continue; }
    if (frag && target.endsWith('.html') && !ids.get(target)?.has(frag)) bad.push(`${path.relative(OUT, p)} -> ${h} (missing anchor)`);
  }
}
console.log(JSON.stringify({ pages: pages.length, broken: bad.length }));
if (bad.length) { console.log([...new Set(bad)].join('\n')); process.exitCode = 2; }
