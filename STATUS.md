# STATUS · app-camioneros · 2026-10-26

## Qué es
Logistic Tracking (Coca-Cola Envases Central / SBI): app React + Capacitor para conductores. Registra el viaje, muestra la espera y entrega el QR que lee el portero. Reemplaza a la app Xamarin Android.

- **QR (contrato con el portero):** `ENV;{RUT};{tracto};{destino};{inicial operación};{pallets};{yyyyMMdd};SbI`.
- **Repos:** `cealvarez93/app-camioneros` (público) y `cealvarez93/app-camioneros-assets` (privado, imágenes de marca).
- **Ambientes:** `qa` → Cloudflare Pages `logistic-qa`, con API simulada. `main` → `logistic-prod`, desactivado hasta definir `PROD_API_BASE`.
- **Flujo:** PR a `qa` con auto-merge si `ci` pasa → deploy y `smoke-qa` → PR de promoción `qa` → `main` → `validar_qa` → producción → tag `prod-ok`; smoke rojo → rollback.
- **MCP** (`mcp/server.mjs`): `get_status`, `fetch_file`, `propose_change`, `validar_qa`, `rollback`. Token fine-grained de un repo, sin Workflows.
- **Tema:** colores solo en `src/theme/tokens.css`; textos de marca en `src/brand.js`. Header de una fila con menú hamburguesa en todas las pantallas.
- **Regla de trabajo:** empujar solo a `qa`; `main` avanza solo por el PR de promoción.
- **Costo:** 0 USD (GitHub Free público, Cloudflare Free, nada en AWS).
- **App y API actuales en uso** (Xamarin + servidor Windows ajeno a la cuenta AWS): este repo no las toca.

## Estado de verificación

| Estado | Qué | Cómo | Resultado | Fecha | Vence si |
|---|---|---|---|---|---|
| Verificado | Tests (app, scripts, MCP con GitHub falso, setup, tema) | `npm test` local | 24/24 | 2026-10-26 | cambia el código |
| Verificado | CI y despliegue de QA | Insignias de Actions en `qa` y `version.json` de QA = `add2bfe` | passing | 2026-10-26 | nuevo push |
| Verificado | Pantallas, menú y atrás por historial | Navegador local a 360 y 390 px | Header 49 px, sin desborde | 2026-10-26 | cambia la UI |
| Supuesto | Forma de las respuestas de la API real | Inferida del IL del APK; solo probada con la API simulada | sin comprobar | 2026-10-26 | se prueba contra una API real |
| Supuesto | Pallets de 1 a 30 | Lista provisional | sin comprobar | 2026-10-26 | se confirma con ECSA |
| Pendiente | Rulesets y límites del colaborador | Falta una cuenta sin admin | | | |
| Pendiente | Flujo completo con un cambio real hasta `validar_qa` | Falta la cuenta del hermano | | | |

## Pendiente
- **Cuenta del hermano:** crear su usuario de GitHub, invitarlo como colaborador (write) y generar su token. Falta su usuario.
- **API real con HTTPS:** sin ella `PROD_API_BASE` queda vacío y producción web no despliega. El dueño del servidor legado y el código de su API no están confirmados ni en ningún repo.
- **APK en CI:** requiere el keystore de producción como secreto de `production`.
- **Push FCM:** sin conectar.
- **iOS:** PWA instalable gratis; App Store cuesta 99 USD/año, decisión de Camilo.
- **PR #1 (`qa` → `main`):** abierto con auto-merge. Aprobarlo solo para avanzar `main`.
- **Tokens a renovar:** `CLOUDFLARE_API_TOKEN` (vence 2027-10-26) y `ASSETS_TOKEN` (~2027-10).
- **Seguridad heredada** (fuera de este repo, carpeta SBI): buckets `sbi.mobile.app` y `transpuerto.ecsa` públicos; hoja de Google `ListadoApp` pública con RUT y teléfonos; contraseña por defecto en `Dashboard/export_data.py`; escritorio remoto abierto en el servidor legado.

## Próximos pasos
1. Camilo entrega el usuario de GitHub del hermano; se invita y él crea su token.
2. Probar el flujo con un cambio real: PR a `qa` por el MCP, promoción y `validar_qa`.
3. Decidir cómo poner HTTPS delante de la API real y definir `PROD_API_BASE`.
4. Agregar el job del APK en CI con su keystore.
5. Contrastar las respuestas de la API real con las inferidas.

## Arranque
Leer la tabla de verificación antes de prescribir. Ruta: `C:\Users\ceal1\Data\SBI\app-camioneros`. Publicar solo a `qa`.
