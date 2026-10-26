import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { plan, ruleset } from '../scripts/setup-github.mjs';

test('rulesets: check ci, PR obligatorio y code owners; main exige 1 aprobación', () => {
  for (const [rama, n] of [['main', 1], ['qa', 0]]) {
    const r = ruleset(rama, rama, n);
    const pr = r.rules.find((x) => x.type === 'pull_request').parameters;
    assert.equal(pr.required_approving_review_count, n);
    assert.equal(pr.require_code_owner_review, true);
    assert.deepEqual(r.rules.find((x) => x.type === 'required_status_checks').parameters.required_status_checks, [{ context: 'ci' }]);
    assert.ok(r.rules.some((x) => x.type === 'non_fast_forward') && r.rules.some((x) => x.type === 'deletion'));
  }
});

test('plan: environments atados a su rama, repo público y assets privado, colaborador con push', () => {
  const p = plan({ owner: 'dueno', colaborador: 'hermano' });
  const por = (que) => p.find((x) => x.que.startsWith(que));
  assert.equal(p[0].cuerpo.private, false);
  assert.equal(p[1].cuerpo.private, true);
  assert.equal(p.find((x) => x.que.includes('environment qa: solo')).cuerpo.name, 'qa');
  assert.equal(p.find((x) => x.que.includes('environment production: solo')).cuerpo.name, 'main');
  assert.equal(por('colaborador').cuerpo.permission, 'push');
  assert.equal(p.find((x) => x.que === 'variable ASSETS_REPO').cuerpo.value, 'dueno/app-camioneros-assets');
  assert.ok(!JSON.stringify(p).toLowerCase().includes('token'));
});

test('workflows: usan solo variables y secretos que el setup o la guía definen', () => {
  const definidos = new Set(['ASSETS_REPO', 'CF_PROJECT_QA', 'CF_PROJECT_PROD', 'QA_URL', 'PROD_URL', 'CLOUDFLARE_ACCOUNT_ID', 'PROD_API_BASE', 'CLOUDFLARE_API_TOKEN', 'ASSETS_TOKEN']);
  for (const f of readdirSync('.github/workflows')) {
    const t = readFileSync(`.github/workflows/${f}`, 'utf8');
    for (const m of t.matchAll(/(?:vars|secrets)\.([A-Z_]+)/g)) assert.ok(definidos.has(m[1]) || m[1] === 'GITHUB_TOKEN', `${f} usa ${m[1]} sin definir`);
  }
});

test('deploy-qa publica un job llamado smoke-qa y ci.yml un job llamado ci', () => {
  assert.match(readFileSync('.github/workflows/deploy-qa.yml', 'utf8'), /^  smoke-qa:/m);
  assert.match(readFileSync('.github/workflows/ci.yml', 'utf8'), /^  ci:/m);
});
