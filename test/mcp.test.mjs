import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { aplicarCambio, ramaDe, verificarEscritura } from '../mcp/policy.mjs';
import { createGithub } from '../mcp/github.mjs';
import * as tools from '../mcp/tools.mjs';
import { crearFake } from './fakeGithub.mjs';

test('policy: rutas permitidas y prohibidas', () => {
  for (const ok of ['src/App.jsx', 'public/sw.js', 'test/x.mjs', 'docs/a.md', 'bitacora.md']) assert.equal(verificarEscritura(ok), ok);
  for (const mal of ['.github/workflows/ci.yml', 'mcp/server.mjs', 'package.json', 'android/app/build.gradle', 'src/assets/x.png', 'capacitor.config.json', 'scripts/smoke.mjs', 'CODEOWNERS']) {
    assert.throws(() => verificarEscritura(mal), (e) => e.estado === 'FORBIDDEN', mal);
  }
  for (const mal of ['../x', '/etc/passwd', 'src//x', 'src\\x']) assert.throws(() => verificarEscritura(mal), (e) => e.estado === 'ERROR', mal);
});

test('policy: aplicarCambio', () => {
  assert.equal(aplicarCambio('a b a', { reemplazar: { old: 'b', new: 'c' } }), 'a c a');
  assert.throws(() => aplicarCambio('a b a', { reemplazar: { old: 'a', new: 'c' } }), /exactamente una vez/);
  assert.throws(() => aplicarCambio('x', { crear: { contenido: 'y' } }), /ya existe/);
  assert.equal(aplicarCambio(null, { crear: { contenido: 'y' } }), 'y');
  assert.equal(ramaDe('Hermano', 'Ajuste Botón QR!'), 'claudia/hermano/ajuste-boton-qr');
});

async function entorno() {
  const f = crearFake(); const api = await f.abrir();
  const gh = createGithub({ token: 't', repo: 'o/r', api });
  const ctx = { gh, login: 'hermano' };
  return { f, api, ctx, cerrar: () => f.server.close() };
}

test('propose_change: rama, PR a qa, auto-merge y decisión', async () => {
  const { f, ctx, cerrar } = await entorno();
  try {
    const base = (await tools.fetchFile(ctx, { path: 'src/App.jsx' })).base_commit;
    const r = await tools.proposeChange(ctx, { path: 'src/App.jsx', cambio: { reemplazar: { old: 'const b = 2;', new: 'const b = 3;' } }, base_commit: base, tema: 'ajuste b', decision: 'Cambia b a 3 por pedido del cliente' });
    assert.equal(r.estado, 'SUCCESS');
    assert.equal(r.rama, 'claudia/hermano/ajuste-b');
    assert.equal(r.auto_merge, true);
    assert.equal(f.s.prs[0].base.ref, 'qa');
    assert.match(f.s.prs[0].body, /Cambia b a 3/);
    assert.equal(f.s.snaps[f.s.ramas[r.rama]]['src/App.jsx'].includes('const b = 3;'), true);
    assert.equal(f.s.snaps[f.s.ramas.qa]['src/App.jsx'].includes('const b = 2;'), true, 'qa intacta hasta que se mezcle el PR');
    // segundo commit sobre el mismo tema reutiliza rama y PR
    const r2 = await tools.proposeChange(ctx, { path: 'src/otro.js', cambio: { reescribir: { contenido: 'y' } }, base_commit: base, tema: 'ajuste b', decision: 'Segundo ajuste del mismo tema' });
    assert.equal(r2.pr, r.pr);
    assert.equal(f.s.prs.length, 1);
  } finally { cerrar(); }
});

test('propose_change: FORBIDDEN, sin decisión y CONFLICTO', async () => {
  const { f, ctx, cerrar } = await entorno();
  try {
    const base = (await tools.fetchFile(ctx, { path: 'src/App.jsx' })).base_commit;
    await assert.rejects(tools.proposeChange(ctx, { path: '.github/workflows/ci.yml', cambio: { crear: { contenido: 'x' } }, base_commit: base, tema: 't', decision: 'una decisión larga' }), (e) => e.estado === 'FORBIDDEN');
    await assert.rejects(tools.proposeChange(ctx, { path: 'src/App.jsx', cambio: { reescribir: { contenido: 'x' } }, base_commit: base, tema: 't', decision: 'corta' }), /Decisión/);
    // qa cambia el archivo después de que el hermano lo leyó
    f.s.snaps.nuevo = { ...f.s.snaps[f.s.ramas.qa], 'src/App.jsx': 'otro contenido' }; f.s.ramas.qa = 'nuevo';
    const r = await tools.proposeChange(ctx, { path: 'src/App.jsx', cambio: { reescribir: { contenido: 'x' } }, base_commit: base, tema: 'choque', decision: 'cambio que choca con qa' });
    assert.equal(r.estado, 'CONFLICTO');
    assert.equal(f.s.prs.length, 0);
  } finally { cerrar(); }
});

test('propose_change: aviso R3 por otra rama sobre el mismo archivo', async () => {
  const { ctx, cerrar } = await entorno();
  try {
    const base = (await tools.fetchFile(ctx, { path: 'src/App.jsx' })).base_commit;
    await tools.proposeChange({ ...ctx, login: 'otro' }, { path: 'src/App.jsx', cambio: { reemplazar: { old: 'const a = 1;', new: 'const a = 9;' } }, base_commit: base, tema: 'a', decision: 'cambio de otra persona' });
    const r = await tools.proposeChange(ctx, { path: 'src/App.jsx', cambio: { reemplazar: { old: 'const b = 2;', new: 'const b = 4;' } }, base_commit: base, tema: 'b', decision: 'cambio mío sobre el mismo archivo' });
    assert.match(r.avisos[0], /claudia\/otro\/a/);
  } finally { cerrar(); }
});

test('validar_qa exige PR de promoción con ci y smoke-qa verdes', async () => {
  const { f, ctx, cerrar } = await entorno();
  try {
    await assert.rejects(tools.validarQa(ctx, { pr_number: 1, decision: 'probé el flujo completo' }), /404/);
    f.s.ramas.qa = 'cpromo00';
    f.s.snaps.cpromo00 = { ...f.s.snaps[f.s.ramas.main], 'src/x.js': '1' };
    f.s.prs.push({ number: 1, state: 'open', head: { ref: 'qa', sha: 'cpromo00' }, base: { ref: 'main' }, user: { login: 'github-actions' }, title: 'p', body: '' });
    await assert.rejects(tools.validarQa(ctx, { pr_number: 1, decision: 'probé el flujo completo' }), (e) => e.estado === 'FORBIDDEN' && /ci no está verde/.test(e.message));
    f.s.checks.cpromo00 = { ci: 'success', 'smoke-qa': 'failure' };
    await assert.rejects(tools.validarQa(ctx, { pr_number: 1, decision: 'probé el flujo completo' }), /smoke-qa no está verde/);
    f.s.checks.cpromo00 = { ci: 'success', 'smoke-qa': 'success' };
    const r = await tools.validarQa(ctx, { pr_number: 1, decision: 'probé el flujo completo' });
    assert.equal(r.estado, 'SUCCESS');
    assert.equal(f.s.reviews['1'][0].state, 'APPROVED');
    // PR que no es de promoción
    f.s.prs.push({ number: 2, state: 'open', head: { ref: 'claudia/x/y', sha: 'c1' }, base: { ref: 'qa' }, user: { login: 'x' }, title: '', body: '' });
    await assert.rejects(tools.validarQa(ctx, { pr_number: 2, decision: 'intento aprobar otro PR' }), (e) => e.estado === 'FORBIDDEN');
  } finally { cerrar(); }
});

test('rollback despacha rollback.yml en main con el motivo', async () => {
  const { f, ctx, cerrar } = await entorno();
  try {
    await tools.rollback(ctx, { decision: 'la pantalla de QR quedó en blanco' });
    assert.equal(f.s.dispatches[0].ref, 'main');
    assert.match(f.s.dispatches[0].inputs.motivo, /hermano: la pantalla/);
  } finally { cerrar(); }
});

test('servidor stdio: lista las 5 herramientas y responde get_status', async () => {
  const f = crearFake(); const api = await f.abrir();
  const transport = new StdioClientTransport({ command: process.execPath, args: ['mcp/server.mjs'], env: { ...process.env, GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', GITHUB_API: api } });
  const client = new Client({ name: 'test', version: '1' });
  try {
    await client.connect(transport);
    const { tools: lista } = await client.listTools();
    assert.deepEqual(lista.map((t) => t.name).sort(), ['fetch_file', 'get_status', 'propose_change', 'rollback', 'validar_qa']);
    const r = await client.callTool({ name: 'get_status', arguments: {} });
    const j = JSON.parse(r.content[0].text);
    assert.equal(j.usuario, 'hermano');
    assert.equal(j.qa_head, f.s.ramas.qa);
    const bad = await client.callTool({ name: 'propose_change', arguments: { path: 'mcp/server.mjs', cambio: { crear: { contenido: 'x' } }, base_commit: j.qa_head, tema: 't', decision: 'intento sobre ruta sensible' } });
    assert.equal(bad.isError, true);
    assert.equal(JSON.parse(bad.content[0].text).estado, 'FORBIDDEN');
  } finally { await client.close(); f.server.close(); }
});
