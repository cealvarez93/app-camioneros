// Smoke post-despliegue: node scripts/smoke.mjs <urlBase> <shaEsperado> [--api <urlBaseApi>]
import { pathToFileURL } from 'node:url';

export async function runSmoke({ base, sha, api }) {
  const fallos = [];
  const get = async (url) => { const r = await fetch(url); return { r, t: await r.text() }; };
  const raiz = base.replace(/\/$/, '');

  const home = await get(raiz + '/');
  if (home.r.status !== 200 || !home.t.includes('id="root"')) fallos.push('/ no responde la app');
  for (const m of home.t.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const a = await fetch(raiz + m[1]);
    if (a.status !== 200) fallos.push(`asset ${m[1]} ${a.status}`);
  }
  const man = await get(raiz + '/manifest.webmanifest');
  try { if (!JSON.parse(man.t).name) fallos.push('manifest sin name'); } catch { fallos.push('manifest inválido'); }
  const ver = await get(raiz + '/version.json');
  try { if (JSON.parse(ver.t).sha !== sha) fallos.push(`version.json sha ${JSON.parse(ver.t).sha} distinto de ${sha}`); } catch { fallos.push('version.json inválido'); }
  if (api) {
    const ops = await get(api.replace(/\/$/, '') + '/api_final/api/dal/GetOperations');
    try { if (!Array.isArray(JSON.parse(ops.t)) || ops.r.status !== 200) fallos.push('GetOperations sin lista'); } catch { fallos.push('GetOperations inválido'); }
  }
  return fallos;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, sha] = process.argv.slice(2);
  const i = process.argv.indexOf('--api');
  const fallos = await runSmoke({ base, sha, api: i > 0 ? process.argv[i + 1] : undefined });
  if (fallos.length) { console.error('smoke: FALLA\n- ' + fallos.join('\n- ')); process.exit(1); }
  console.log('smoke: ok');
}
