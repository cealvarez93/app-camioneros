// Herramientas del MCP. Cada una recibe el contexto { gh, login, qaUrl, prodUrl } y devuelve un objeto serializable.
import { GithubError } from './github.mjs';
import { aplicarCambio, exigirDecision, ramaDe, Rechazo, normalizarRuta, verificarEscritura } from './policy.mjs';

const REGLAS = [
  'R1 Abrir sesión con get_status',
  'R2 La identidad es el usuario del token: autor de commits y PRs',
  'R3 Aviso si otra rama abierta toca el mismo archivo',
  'R4 Ante CONFLICTO, fetch_file de nuevo y reaplicar',
  'R5 Escritura solo por PR hacia qa; producción solo por la promoción qa → main',
  'R6 CI verde antes de mezclar',
  'R7 Smoke post-despliegue y rollback al tag prod-ok',
  'R8 Cada PR lleva su Decisión visible',
];

const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');
const deB64 = (t) => Buffer.from(t, 'base64').toString('utf8');
const codificar = (ruta) => ruta.split('/').map(encodeURIComponent).join('/');
const noEncontrado = (e) => e instanceof GithubError && e.status === 404;

async function checks(gh, sha) {
  const r = await gh.get(`/commits/${sha}/check-runs?per_page=50`);
  return Object.fromEntries(r.check_runs.map((c) => [c.name, c.status === 'completed' ? c.conclusion : c.status]));
}

async function versionDesplegada(url) {
  if (!url) return null;
  try { const r = await fetch(url.replace(/\/$/, '') + '/version.json'); return r.ok ? await r.json() : null; } catch { return null; }
}

export async function getStatus({ gh, login, qaUrl, prodUrl }) {
  const [qa, main] = await Promise.all([gh.get('/branches/qa'), gh.get('/branches/main')]);
  const [dQa, dProd] = await Promise.all([versionDesplegada(qaUrl), versionDesplegada(prodUrl)]);
  const prs = await gh.get('/pulls?state=open&per_page=10');
  const abiertos = [];
  for (const p of prs) {
    const [ck, revs] = await Promise.all([checks(gh, p.head.sha), gh.get(`/pulls/${p.number}/reviews`)]);
    const ultimo = new Map();
    for (const r of revs) ultimo.set(r.user.login, r.state);
    abiertos.push({
      pr: p.number, rama: p.head.ref, base: p.base.ref, dueno: p.user.login, titulo: p.title,
      ci: ck.ci ?? 'sin ejecutar', smoke_qa: ck['smoke-qa'] ?? null,
      aprobado: [...ultimo.values()].includes('APPROVED'), auto_merge: Boolean(p.auto_merge),
    });
  }
  const commits = await gh.get('/commits?sha=qa&per_page=8');
  return {
    usuario: login,
    qa_head: qa.commit.sha, main_head: main.commit.sha,
    desplegado: { qa: dQa?.sha ?? null, produccion: dProd?.sha ?? null },
    sin_desplegar_en_qa: dQa ? dQa.sha !== qa.commit.sha : null,
    prs_abiertos: abiertos,
    eventos_recientes: commits.map((c) => ({ commit: c.sha.slice(0, 7), autor: c.commit.author.name, fecha: c.commit.author.date, mensaje: c.commit.message.split('\n')[0] })),
    reglas: REGLAS,
  };
}

export async function fetchFile({ gh }, { path, ref = 'qa' }) {
  const p = normalizarRuta(path);
  const head = (await gh.get(`/branches/${encodeURIComponent(ref)}`)).commit.sha;
  const f = await gh.get(`/contents/${codificar(p)}?ref=${encodeURIComponent(ref)}`);
  if (Array.isArray(f)) return { path: p, ref, base_commit: head, entradas: f.map((e) => ({ nombre: e.name, tipo: e.type })) };
  return { path: p, ref, base_commit: head, blob: f.sha, contenido: deB64(f.content) };
}

async function archivoEn(gh, ruta, ref) {
  try {
    const f = await gh.get(`/contents/${codificar(ruta)}?ref=${encodeURIComponent(ref)}`);
    return { sha: f.sha, texto: deB64(f.content) };
  } catch (e) { if (noEncontrado(e)) return null; throw e; }
}

async function avisosR3(gh, path, ramaPropia) {
  const prs = await gh.get('/pulls?state=open&per_page=30');
  const avisos = [];
  for (const p of prs) {
    if (!p.head.ref.startsWith('claudia/') || p.head.ref === ramaPropia) continue;
    const archivos = await gh.get(`/pulls/${p.number}/files?per_page=100`);
    if (archivos.some((a) => a.filename === path)) avisos.push(`la rama ${p.head.ref} (PR ${p.number}) también modifica ${path}`);
  }
  return avisos;
}

export async function proposeChange({ gh, login }, { path, cambio, base_commit, tema, decision }) {
  const ruta = verificarEscritura(path);
  const dec = exigirDecision(decision);
  const rama = ramaDe(login, tema);
  const qaHead = (await gh.get('/branches/qa')).commit.sha;

  let cmp;
  try { cmp = await gh.get(`/compare/${encodeURIComponent(base_commit)}...${qaHead}`); } catch (e) { if (noEncontrado(e)) throw new Rechazo('ERROR', 'base_commit desconocido; usa el de fetch_file'); throw e; }
  if (cmp.files.some((f) => f.filename === ruta)) return { estado: 'CONFLICTO', mensaje: `${ruta} cambió en qa desde ${base_commit.slice(0, 7)}; vuelve a leerlo con fetch_file y reaplica`, qa_head: qaHead };

  let existe = true;
  try { await gh.get(`/git/ref/heads/${rama}`); } catch (e) { if (noEncontrado(e)) existe = false; else throw e; }
  if (!existe) await gh.post('/git/refs', { ref: `refs/heads/${rama}`, sha: qaHead });

  const actual = await archivoEn(gh, ruta, rama);
  const nuevo = aplicarCambio(actual ? actual.texto : null, cambio);
  const avisos = await avisosR3(gh, ruta, rama);
  const mensaje = `${tema}: ${dec.split('\n')[0].slice(0, 60)}\n\nDecisión: ${dec}\nAutor: ${login}`;
  const commit = await gh.put(`/contents/${codificar(ruta)}`, { message: mensaje, content: b64(nuevo), branch: rama, ...(actual ? { sha: actual.sha } : {}) });

  const abiertos = await gh.get(`/pulls?state=open&head=${encodeURIComponent(gh.repo.split('/')[0] + ':' + rama)}`);
  let pr = abiertos[0];
  if (!pr) pr = await gh.post('/pulls', { title: tema, head: rama, base: 'qa', body: `Decisiones:\n- ${dec}\n\nAutor: ${login}` });
  else pr = await gh.patch(`/pulls/${pr.number}`, { body: `${pr.body}\n- ${dec}` });

  let autoMerge = true; let nota;
  try {
    const g = await gh.graphql('mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:SQUASH}){pullRequest{number}}}', { id: pr.node_id });
    if (g.errors?.length) { autoMerge = false; nota = g.errors[0].message; }
  } catch (e) { autoMerge = false; nota = e.message; }

  return { estado: 'SUCCESS', rama, pr: pr.number, commit: commit.commit.sha, auto_merge: autoMerge, ...(nota ? { nota_auto_merge: nota } : {}), ...(avisos.length ? { avisos } : {}) };
}

export async function validarQa({ gh, login, qaUrl }, { pr_number, decision }) {
  const dec = exigirDecision(decision);
  const pr = await gh.get(`/pulls/${pr_number}`);
  if (pr.state !== 'open' || pr.head.ref !== 'qa' || pr.base.ref !== 'main') throw new Rechazo('FORBIDDEN', 'validar_qa solo aplica al PR de promoción abierto qa → main');
  const ck = await checks(gh, pr.head.sha);
  for (const n of ['ci', 'smoke-qa']) if (ck[n] !== 'success') throw new Rechazo('FORBIDDEN', `${n} no está verde sobre ${pr.head.sha.slice(0, 7)} (estado: ${ck[n] ?? 'sin ejecutar'})`);
  const d = await versionDesplegada(qaUrl);
  if (qaUrl && d?.sha !== pr.head.sha) throw new Rechazo('FORBIDDEN', `QA sirve ${d?.sha?.slice(0, 7) ?? 'nada'}, el PR es ${pr.head.sha.slice(0, 7)}; espera el despliegue de QA`);
  await gh.post(`/pulls/${pr_number}/reviews`, { event: 'APPROVE', commit_id: pr.head.sha, body: `Validado en QA por ${login}: ${dec}` });
  return { estado: 'SUCCESS', pr: pr_number, commit: pr.head.sha, mensaje: 'aprobado; se mezcla solo y despliega a producción' };
}

export async function rollback({ gh, login }, { decision }) {
  const dec = exigirDecision(decision);
  await gh.post('/actions/workflows/rollback.yml/dispatches', { ref: 'main', inputs: { motivo: `${login}: ${dec}` } });
  return { estado: 'SUCCESS', mensaje: 'rollback al tag prod-ok en curso; revisa get_status y el run de Actions' };
}
