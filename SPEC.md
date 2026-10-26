# SPEC: Flujo QA/prod con MCP (app-camioneros)

Rigor: datos/git · Estado: construido en local; sin publicar en GitHub · Costo: 0 USD

## Resultado
El hermano de Camilo, desde su Claude, cambia solo QA. Producción se actualiza únicamente por la promoción QA → main, con CI verde y la validación del hermano. GitHub impone los límites; el MCP los facilita y deja rastro.

## Ambientes

| | Local | QA | Producción |
|---|---|---|---|
| Rama | `claudia/<usuario>/<tema>` | `qa` | `main` |
| Web/PWA | `npm run dev` | Cloudflare Pages `logistic-qa` | Cloudflare Pages `logistic` |
| API | `server/mock.mjs` | mock ficticio (Pages Function) | API real por HTTPS (variable del environment `production`) |
| Android | `npm run cap:sync` | APK `cl.sbi.logistic.qa` en GitHub pre-release | APK `cl.sbi.logistic` en GitHub Release |
| Secretos | ninguno | environment `qa` (rama `qa`) | environment `production` (rama `main`; incluye keystore) |

## Flujo
1. Hermano: `get_status` → `fetch_file` → `propose_change` (rama `claudia/<usuario>/<tema>`, PR hacia `qa`, campo Decisión obligatorio).
2. CI (`ci`: tests + build + guardia sin host de producción) corre en el PR; con verde y sin rutas sensibles el PR se mezcla solo en `qa`.
3. Push a `qa` despliega a QA, corre el smoke de QA y abre o actualiza el PR de promoción `qa` → `main`, con las Decisiones de los PRs incluidas.
4. Hermano prueba QA y llama `validar_qa` (aprobación del PR de promoción, solo con smoke de QA verde sobre el mismo commit).
5. Aprobación + `ci` verde → auto-merge a `main` → despliegue a producción → smoke de producción.
6. Smoke rojo → rollback automático: redespliegue del último commit bueno (tag `prod-ok`); smoke verde mueve `prod-ok`.

## Permisos mínimos

| Actor | Puede | Límite impuesto por |
|---|---|---|
| Claude del hermano (PAT fine-grained, un repo) | Contents RW, Pull requests RW, Actions RW, Metadata R | PAT sin permiso Workflows ni Administration ni Secrets |
| Hermano (colaborador Write) | Ramas `claudia/*`, PRs, aprobar PRs ajenos | Rulesets de `qa` y `main` |
| CI (`GITHUB_TOKEN`) | Desplegar, abrir PR de promoción, mover `prod-ok` | Secretos por environment y rama |
| Camilo (Admin) | Rulesets, secretos, rutas sensibles, bypass de emergencia (queda en el registro) | Admin del repo |

Rutas sensibles (CODEOWNERS = Camilo): `.github/**`, `mcp/**`, `android/**`, `package.json`, `package-lock.json`, `capacitor.config.json`, `CODEOWNERS`.

## Rulesets
- `main` y `qa`: PR obligatorio, sin push directo ni force-push, check `ci` requerido, borrado prohibido.
- `main`: 1 aprobación de usuario distinto del autor, aprobaciones obsoletas descartadas al haber commits nuevos, review de code owners.
- `qa`: 0 aprobaciones, review de code owners (solo rutas sensibles).
- Environments `qa` y `production`: despliegue restringido a su rama.

## Herramientas MCP (`mcp/server.mjs`, stdio, Node, API REST de GitHub)

| Herramienta | Hace | Compuerta |
|---|---|---|
| `get_status` | Commit de `qa`/`main`, commit desplegado por ambiente, PRs con CI y aprobación, últimos eventos | R1 |
| `fetch_file(path, ref='qa')` | Contenido, `base_commit`, blob | Solo lectura |
| `propose_change` | Rama, commit, PR a `qa`, auto-merge | `base_commit` vigente (CONFLICTO → volver a leer), ruta permitida (`src/**`, `public/**`, `test/**`, `docs/**`, `bitacora.md`), Decisión no vacía |
| `validar_qa(pr)` | Aprobación del PR de promoción | Smoke QA verde sobre el mismo commit |
| `rollback` | Redespliega `prod-ok` | Solo si el último despliegue de producción falló o el hermano lo pide |
| Registro | PRs con Decisión, commits con autor y runs de Actions | R2, R8 |

## Smoke
- QA: `/` 200, assets del `index.html` 200, `manifest.webmanifest` válido, contrato de la API mock (`npm test`).
- Producción: lo anterior + GET de solo lectura `GetOperations` por la base HTTPS de producción + el `sha` publicado en `/version.json` igual al desplegado.
- APK: asset descargable por URL estable, `versionCode` mayor que el anterior, `applicationId` correcto.

## Costo
GitHub Free (repo público, Actions gratis), Cloudflare Free (Pages, Functions), 0 recursos AWS, APK compilado en el runner (JDK incluido).

## Pendiente de Camilo
1. Repo público (GitHub Free solo impone rulesets y reviewers de environment en repos públicos). Los logos del cliente pasan a un repo privado de assets descargado en el build si prefieres no publicarlos.
2. Cuenta GitHub del hermano y Cuenta Cloudflare Free con token de Pages.
3. HTTPS delante de la API real: hasta entonces producción es solo APK y la PWA de producción espera.
4. Firma del APK: keystore nuevo guardado como secreto de `production`.

## Criterios de aceptación (comando → condición)
1. `gh api repos/<owner>/<repo>/rulesets` → rulesets `main` y `qa` con check `ci` requerido.
2. `git push origin HEAD:main` con el PAT del hermano → rechazado.
3. Push de `.github/workflows/x.yml` con el PAT del hermano → rechazado.
4. `propose_change` sobre `.github/workflows/ci.yml` → FORBIDDEN.
5. PR a `qa` con `ci` verde → mezclado solo; QA responde `/version.json` con su sha; PR de promoción creado.
6. PR de promoción sin `validar_qa` → sin mezclar; tras `validar_qa` → mezclado, producción responde su sha, smoke verde.
7. Release con smoke de producción forzado a fallar → producción vuelve al sha de `prod-ok`.
8. `node scripts/guard-build.mjs` → falla si el build contiene la IP histórica de producción o una URL HTTP plana.
9. Facturación de GitHub y Cloudflare → 0 USD.

## Punto débil
La validación del hermano usa una API mock: cubre las pantallas y el contrato inferido. La integración con el servidor real, que no tiene QA propio, queda sin probar.
