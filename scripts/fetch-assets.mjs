// Copia las imágenes de marca desde el repo privado de assets (ASSETS_DIR) a src/assets y public/.
// Sin ASSETS_DIR genera marcadores neutros (CI de PR). Con --require falla si faltan los reales.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GRUPOS = { 'src/assets': ['bg3.jpg', 'clock1.jpg', 'logo3.png', 'profile2.jpg', 'qr1.jpg', 'sbi.jpg', 'truck3.jpg'], public: ['icon-192.png', 'icon-512.png'] };
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const requerir = process.argv.includes('--require');
const origen = resolve(process.env.ASSETS_DIR || '../app-camioneros-assets');
const reales = existsSync(origen);
if (requerir && !reales) {
  console.error(`fetch-assets: faltan los assets reales en ${origen}`);
  process.exit(1);
}
for (const [destino, archivos] of Object.entries(GRUPOS)) {
  mkdirSync(destino, { recursive: true });
  for (const f of archivos) {
    const src = join(origen, f);
    if (reales && existsSync(src)) copyFileSync(src, join(destino, f));
    else if (requerir) { console.error(`fetch-assets: falta ${f}`); process.exit(1); }
    else writeFileSync(join(destino, f), PNG_1X1);
  }
}
console.log(`fetch-assets: ${reales ? 'assets reales' : 'marcadores neutros'}`);
