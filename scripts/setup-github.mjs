// Prepara GitHub: repos, ajustes, environments, variables, rulesets y colaborador. Lo ejecuta Camilo (admin) una vez.
//   GITHUB_ADMIN_TOKEN=... GITHUB_OWNER=... node scripts/setup-github.mjs            (muestra el plan)
//   GITHUB_ADMIN_TOKEN=... GITHUB_OWNER=... COLABORADOR=... node scripts/setup-github.mjs --apply
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function ruleset(nombre, rama, aprobaciones) {
  return {
    name: nombre, target: 'branch', enforcement: 'active',
    conditions: { ref_name: { include: [`refs/heads/${rama}`], exclude: [] } },
    bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'pull_request', parameters: { required_approving_review_count: aprobaciones, dismiss_stale_reviews_on_push: true, require_code_owner_review: true, require_last_push_approval: aprobaciones > 0, required_review_thread_resolution: false } },
      { type: 'required_status_checks', parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: 'ci' }] } },
    ],
  };
}

export function plan({ owner, repo = 'app-camioneros', assetsRepo = 'app-camioneros-assets', colaborador, tipoOwner = 'user', cfProjectQa = 'logistic-qa', cfProjectProd = 'logistic-prod', cfAccountId }) {
  const r = `/repos/${owner}/${repo}`;
  const creacion = tipoOwner === 'org' ? `/orgs/${owner}/repos` : '/user/repos';
  const variables = {
    ASSETS_REPO: `${owner}/${assetsRepo}`, CF_PROJECT_QA: cfProjectQa, CF_PROJECT_PROD: cfProjectProd,
    QA_URL: `https://${cfProjectQa}.pages.dev`, PROD_URL: `https://${cfProjectProd}.pages.dev`,
    ...(cfAccountId ? { CLOUDFLARE_ACCOUNT_ID: cfAccountId } : {}),
  };
  return [
    { que: 'crear repo público', metodo: 'POST', ruta: creacion, cuerpo: { name: repo, private: false, description: 'Logistic Tracking (Coca-Cola Envases Central / SBI)' } },
    { que: 'crear repo privado de assets', metodo: 'POST', ruta: creacion, cuerpo: { name: assetsRepo, private: true, description: 'Imágenes de marca' } },
    { que: 'ajustes del repo', metodo: 'PATCH', ruta: r, cuerpo: { allow_auto_merge: true, delete_branch_on_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: false } },
    { que: 'permisos de Actions (crear PR de promoción)', metodo: 'PUT', ruta: `${r}/actions/permissions/workflow`, cuerpo: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: true } },
    ...['qa', 'production'].flatMap((env) => [
      { que: `environment ${env}`, metodo: 'PUT', ruta: `${r}/environments/${env}`, cuerpo: { deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } } },
      { que: `environment ${env}: solo rama ${env === 'qa' ? 'qa' : 'main'}`, metodo: 'POST', ruta: `${r}/environments/${env}/deployment-branch-policies`, cuerpo: { name: env === 'qa' ? 'qa' : 'main', type: 'branch' } },
    ]),
    ...Object.entries(variables).map(([name, value]) => ({ que: `variable ${name}`, metodo: 'POST', ruta: `${r}/actions/variables`, cuerpo: { name, value } })),
    { que: 'publicar código (main y qa) y assets', git: true },
    { que: 'ruleset main', metodo: 'POST', ruta: `${r}/rulesets`, cuerpo: ruleset('main', 'main', 1) },
    { que: 'ruleset qa', metodo: 'POST', ruta: `${r}/rulesets`, cuerpo: ruleset('qa', 'qa', 0) },
    ...(colaborador ? [{ que: `colaborador ${colaborador} (write)`, metodo: 'PUT', ruta: `${r}/collaborators/${colaborador}`, cuerpo: { permission: 'push' } }] : []),
  ];
}

function git(dir, token, ...args) {
  const auth = Buffer.from(`x-access-token:${token}`).toString('base64');
  return execFileSync('git', ['-C', dir, '-c', `http.extraheader=AUTHORIZATION: basic ${auth}`, ...args], { stdio: 'pipe' }).toString();
}

function publicar({ owner, repo, assetsRepo, token }) {
  const codigo = readFileSync('CODEOWNERS', 'utf8');
  if (codigo.includes('__OWNER__')) writeFileSync('CODEOWNERS', codigo.replaceAll('__OWNER__', owner));
  if (execFileSync('git', ['status', '--porcelain', 'CODEOWNERS']).toString().trim()) {
    execFileSync('git', ['add', 'CODEOWNERS']);
    // El correo noreply de GitHub evita publicar el correo personal en el historial del repo público.
    execFileSync('git', ['-c', `user.name=${owner}`, '-c', `user.email=${owner}@users.noreply.github.com`, 'commit', '-m', 'CODEOWNERS con el dueño del repo']);
  }
  execFileSync('git', ['branch', '-M', 'main']);
  for (const [dir, nombre, ramas] of [['.', repo, ['main:main', 'main:qa']], ['../app-camioneros-assets', assetsRepo, ['HEAD:refs/heads/main']]]) {
    try { git(dir, token, 'remote', 'add', 'origin', `https://github.com/${owner}/${nombre}.git`); } catch { /* ya existe */ }
    for (const rama of ramas) git(dir, token, 'push', 'origin', rama);
  }
}

async function main() {
  const { GITHUB_ADMIN_TOKEN: token, GITHUB_OWNER: owner, COLABORADOR: colaborador, GITHUB_OWNER_TYPE: tipoOwner, CF_ACCOUNT_ID: cfAccountId } = process.env;
  const pasos = plan({ owner: owner || '<OWNER>', colaborador, tipoOwner, cfAccountId });
  const aplicar = process.argv.includes('--apply');
  if (!aplicar) { for (const p of pasos) console.log(`- ${p.que}${p.ruta ? `  [${p.metodo} ${p.ruta}]` : ''}`); console.log('\n(plan; agrega --apply para ejecutar)'); return; }
  if (!token || !owner) { console.error('Faltan GITHUB_ADMIN_TOKEN y GITHUB_OWNER'); process.exit(1); }
  for (const p of pasos) {
    if (p.git) { publicar({ owner, repo: 'app-camioneros', assetsRepo: 'app-camioneros-assets', token }); console.log(`ok  ${p.que}`); continue; }
    const r = await fetch(`https://api.github.com${p.ruta}`, { method: p.metodo, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'logistic-setup' }, body: JSON.stringify(p.cuerpo) });
    console.log(`${r.ok ? 'ok ' : [409, 422].includes(r.status) ? 'ya ' : 'ERR'} ${p.que} (${r.status})`);
    if (!r.ok && ![409, 422].includes(r.status)) { console.error(await r.text()); process.exit(1); }
  }
  console.log(`\nPendiente manual (los secretos no pasan por este script):
1. Cloudflare: crear proyectos  npx wrangler pages project create logistic-qa --production-branch=main  y  logistic-prod
2. Secretos del environment qa y production: CLOUDFLARE_API_TOKEN, ASSETS_TOKEN (fine-grained, solo lectura del repo de assets)
3. Variable CLOUDFLARE_ACCOUNT_ID (si no se pasó CF_ACCOUNT_ID) y, cuando exista la API en HTTPS, PROD_API_BASE
4. Opcional QA: KV namespace TRIPS enlazado al proyecto logistic-qa (persiste viajes entre instancias)
5. El hermano crea su token fine-grained (un repo: Contents RW, Pull requests RW, Actions RW, Metadata R; sin Workflows)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
