// Presentación de datos del conductor.
export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

// 11111111-1 → 11.111.111-1; si no tiene forma de RUT se devuelve igual.
export function formatRut(rut) {
  const m = String(rut || '').replace(/\./g, '').match(/^(\d{1,8})-?([\dkK])$/);
  if (!m) return String(rut || '');
  return `${m[1].replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${m[2].toUpperCase()}`;
}
