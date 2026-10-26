// Falla si el build contiene la IP histórica de producción o una base de API en HTTP plano.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PROHIBIDOS = ['44.199.164.222'];
const dir = process.argv[2] || 'dist';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let fallos = 0;
for (const f of walk(dir).filter((p) => /\.(js|html|css|json|webmanifest)$/.test(p))) {
  const t = readFileSync(f, 'utf8');
  for (const h of PROHIBIDOS) if (t.includes(h)) { console.error(`guard-build: ${f} contiene ${h}`); fallos++; }
  for (const m of t.matchAll(/http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)[\w.-]+/g)) { console.error(`guard-build: ${f} contiene ${m[0]} (HTTP plano)`); fallos++; }
}
if (fallos) process.exit(1);
console.log('guard-build: ok');
