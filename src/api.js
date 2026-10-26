// Cliente de la API existente (/api_final/api/dal/). Base configurable por VITE_API_BASE.
const BASE = (import.meta.env?.VITE_API_BASE || '') + '/api_final/api/dal/';

async function get(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

export const api = {
  login: (user, password) => get(`GetLoginUser?user=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`),
  profile: (drvId) => get(`GetDriverProfile?drvId=${drvId}`),
  trip: (drvId) => get(`GetTripByDrvId?DrvId=${drvId}`),
  queue: () => get('GetClockingTiming'),
  origenes: () => get('GetOrigenLocations'),
  destinos: () => get('GetDestinosLocations'),
  operaciones: () => get('GetOperations'),
  saveTrip: (trip) => post('SaveTrip', trip),
  updateFcm: (drvId, token) => post('UpdateFCM', { Drv_Id: drvId, FCM_Token: token }),
};
