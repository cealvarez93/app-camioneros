import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSmoke } from '../scripts/smoke.mjs';

function sitio(sha, { sinRoot = false } = {}) {
  return http.createServer((req, res) => {
    const rutas = {
      '/': sinRoot ? '<html></html>' : '<div id="root"></div><script src="/assets/a.js"></script>',
      '/assets/a.js': 'x',
      '/manifest.webmanifest': JSON.stringify({ name: 'Logistic' }),
      '/version.json': JSON.stringify({ sha }),
      '/api_final/api/dal/GetOperations': JSON.stringify([{ Op_Id: 1 }]),
    };
    if (rutas[req.url] === undefined) { res.writeHead(404); return res.end(); }
    res.writeHead(200); res.end(rutas[req.url]);
  });
}
const abrir = (s) => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${s.address().port}`)));

test('smoke pasa con sitio sano y sha correcto', async () => {
  const s = sitio('abc'); const base = await abrir(s);
  try { assert.deepEqual(await runSmoke({ base, sha: 'abc', api: base }), []); } finally { s.close(); }
});

test('smoke falla con sha distinto y con app sin root', async () => {
  const s = sitio('abc', { sinRoot: true }); const base = await abrir(s);
  try {
    const f = await runSmoke({ base, sha: 'zzz' });
    assert.ok(f.some((x) => x.includes('distinto')) && f.some((x) => x.includes('/ no responde')));
  } finally { s.close(); }
});

test('guard-build rechaza la IP histórica y HTTP plano', () => {
  const d = mkdtempSync(join(tmpdir(), 'guard-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'a.js'), 'const b="http://44.199.164.222/x"');
  assert.throws(() => execFileSync('node', ['scripts/guard-build.mjs', d], { stdio: 'pipe' }));
  writeFileSync(join(d, 'assets', 'a.js'), 'const b="https://api.example.com"; // http://localhost:8787');
  execFileSync('node', ['scripts/guard-build.mjs', d], { stdio: 'pipe' });
});

test('fetch-assets --require falla sin assets reales', () => {
  assert.throws(() => execFileSync('node', ['scripts/fetch-assets.mjs', '--require'], { stdio: 'pipe', env: { ...process.env, ASSETS_DIR: join(tmpdir(), 'no-existe-xyz') } }));
});
