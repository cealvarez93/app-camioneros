import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

test('los colores viven solo en theme/tokens.css', () => {
  const archivos = walk('src').filter((f) => /\.(css|jsx?)$/.test(f) && !f.endsWith('tokens.css'));
  for (const f of archivos) {
    const sinComentarios = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const lineas = sinComentarios.split('\n').filter((l) => COLOR.test(l) && !l.includes('rgba(255, 255, 255') );
    assert.deepEqual(lineas, [], `${f} tiene colores fuera de tokens.css`);
  }
});

test('los componentes solo usan variables definidas en tokens.css', () => {
  const tokens = readFileSync('src/theme/tokens.css', 'utf8');
  const definidas = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const css = readFileSync('src/theme/components.css', 'utf8');
  const locales = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const usadas = [...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  const faltan = [...new Set(usadas)].filter((v) => !definidas.has(v) && !locales.has(v));
  assert.deepEqual(faltan, []);
});
