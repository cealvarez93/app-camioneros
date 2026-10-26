// Reglas puras del MCP: qué rutas se pueden tocar y cómo se aplica un cambio.
const PERMITIDAS = [/^src\//, /^public\//, /^test\//, /^docs\//, /^bitacora\.md$/];
const GENERADAS = [/^src\/assets\//, /^public\/icon-/];

export class Rechazo extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

export function normalizarRuta(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') || path.split('/').some((s) => s === '..' || s === '.' || s === '')) {
    throw new Rechazo('ERROR', `ruta inválida: ${path}`);
  }
  return path;
}

export function verificarEscritura(path) {
  const p = normalizarRuta(path);
  if (GENERADAS.some((r) => r.test(p)) || !PERMITIDAS.some((r) => r.test(p))) {
    throw new Rechazo('FORBIDDEN', `ruta fuera de las permitidas (src/, public/, test/, docs/, bitacora.md): ${p}`);
  }
  return p;
}

export function slug(tema) {
  const s = String(tema || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!s) throw new Rechazo('ERROR', 'tema vacío');
  return s;
}

export const ramaDe = (login, tema) => `claudia/${String(login).toLowerCase()}/${slug(tema)}`;

export function exigirDecision(decision) {
  const d = String(decision || '').trim();
  if (d.length < 10) throw new Rechazo('ERROR', 'la Decisión es obligatoria (mínimo 10 caracteres): qué cambia y por qué');
  return d;
}

// original: texto actual o null si el archivo no existe.
export function aplicarCambio(original, cambio) {
  const claves = Object.keys(cambio || {});
  if (claves.length !== 1) throw new Rechazo('ERROR', 'cambio debe tener una sola clave: reemplazar, crear o reescribir');
  const [op] = claves;
  const c = cambio[op];
  if (op === 'crear') {
    if (original !== null) throw new Rechazo('ERROR', 'el archivo ya existe; usa reemplazar o reescribir');
    return String(c.contenido);
  }
  if (original === null) throw new Rechazo('ERROR', 'el archivo no existe; usa crear');
  if (op === 'reescribir') return String(c.contenido);
  if (op === 'reemplazar') {
    const n = original.split(c.old).length - 1;
    if (!c.old || n !== 1) throw new Rechazo('ERROR', `old debe aparecer exactamente una vez; aparece ${n}`);
    return original.replace(c.old, () => c.new);
  }
  throw new Rechazo('ERROR', `operación desconocida: ${op}`);
}
