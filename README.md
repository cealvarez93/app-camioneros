# app-camioneros

React + Capacitor para "Logistic Tracking" (Coca-Cola Envases Central / SBI). Diseño del flujo QA/prod en `SPEC.md`.

## Uso local
```bash
npm install
npm run mock     # API simulada en :8787 (usuario 11111111-1 / clave demo)
npm run dev      # app en http://127.0.0.1:5173
npm test         # app, scripts, MCP (con GitHub falso) y setup
```
Las imágenes de marca viven en el repo privado `app-camioneros-assets` (carpeta hermana en local). `node scripts/fetch-assets.mjs` las copia; sin ellas genera marcadores neutros.

## Contrato con el portero
- API: `/api_final/api/dal/` con los 9 endpoints de la app actual (`src/api.js`).
- QR: `ENV;{RUT};{tracto};{destino};{inicial operación};{pallets};{yyyyMMdd};SbI` (`src/qr.js`).

## Flujo
`claudia/<usuario>/<tema>` → PR a `qa` (auto-merge con `ci` verde) → deploy QA + `smoke-qa` → PR de promoción `qa` → `main` → `validar_qa` → deploy producción + smoke → tag `prod-ok`. Smoke rojo: rollback a `prod-ok`.

## MCP del hermano (`mcp/server.mjs`)
```bash
claude mcp add logistic -e GITHUB_TOKEN=<token fine-grained> -e GITHUB_REPO=<owner>/app-camioneros -e QA_URL=https://logistic-qa.pages.dev -e PROD_URL=https://logistic-prod.pages.dev -- node mcp/server.mjs
```
Herramientas: `get_status`, `fetch_file`, `propose_change`, `validar_qa`, `rollback`.

## Puesta en marcha (una vez, Camilo)
`GITHUB_ADMIN_TOKEN=... GITHUB_OWNER=... COLABORADOR=... node scripts/setup-github.mjs` muestra el plan; `--apply` lo ejecuta y lista los pasos manuales (secretos, Cloudflare).

## Pendiente
- APK en CI (JDK 17 en el runner, keystore de producción) y su release.
- HTTPS delante de la API real: variable `PROD_API_BASE` activa el despliegue de producción.
- Forma exacta de las respuestas de la API real; lista de pallets (1–30 supuesta); push FCM.
