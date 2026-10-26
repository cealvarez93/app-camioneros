// Núcleo de la API simulada (mismos endpoints y campos que /api_final/api/dal/). Datos ficticios.
// Lo usan el servidor local (mock.mjs) y la Pages Function de QA (functions/).
const drivers = [
  { Drv_Id: 1, Drv_UserId: '11111111-1', Drv_Password: 'demo', Drv_Name: 'Conductor Demo', Drv_Company: 'Transportes Demo', Drv_Phone: '+56 9 0000 0000', Drv_Mail: 'demo@example.com' },
];
const origenes = [{ Loc_Id: 1, Loc_Name: 'CD Maipú', LocType: 'O' }, { Loc_Id: 2, Loc_Name: 'Planta Renca', LocType: 'O' }];
const destinos = [{ Loc_Id: 3, Loc_Name: 'Antofagasta', LocType: 'D' }, { Loc_Id: 4, Loc_Name: 'Temuco', LocType: 'D' }];
const operaciones = [{ Op_Id: 1, Op_Name: 'Carga' }, { Op_Id: 2, Op_Name: 'Descarga' }];

export function memoryStore() {
  const trips = new Map();
  return { getTrip: async (id) => trips.get(String(id)), setTrip: async (id, t) => { trips.set(String(id), t); } };
}

// kv: binding de Cloudflare KV (get/put). Persiste los viajes entre instancias de la Function.
export function kvStore(kv) {
  return { getTrip: async (id) => kv.get(`trip:${id}`, 'json'), setTrip: async (id, t) => kv.put(`trip:${id}`, JSON.stringify(t)) };
}

const PREFIJO = /^\/api_final\/api\/dal\/(\w+)$/;

export async function handle({ method, url, bodyText = '' }, store) {
  const u = new URL(url, 'http://x');
  const m = u.pathname.match(PREFIJO);
  if (!m) return { status: 404, body: { error: 'no existe' } };
  const q = (k) => u.searchParams.get(k);
  switch (`${method} ${m[1]}`) {
    case 'GET GetLoginUser': {
      const d = drivers.find((x) => x.Drv_UserId === q('user') && x.Drv_Password === q('password'));
      return d ? { status: 200, body: d } : { status: 404, body: { error: 'credenciales inválidas' } };
    }
    case 'GET GetDriverProfile': {
      const d = drivers.find((x) => String(x.Drv_Id) === q('drvId'));
      return d ? { status: 200, body: { ...d, Drv_Password: undefined } } : { status: 404, body: { error: 'no existe' } };
    }
    case 'GET GetTripByDrvId': return { status: 200, body: (await store.getTrip(q('DrvId'))) ?? undefined };
    case 'GET GetClockingTiming': return { status: 200, body: { QuantityTrucks: 3, Minutesxtruck: 13 } };
    case 'GET GetOrigenLocations': return { status: 200, body: origenes };
    case 'GET GetDestinosLocations': return { status: 200, body: destinos };
    case 'GET GetOperations': return { status: 200, body: operaciones };
    case 'POST SaveTrip': {
      let t;
      try { t = JSON.parse(bodyText || '{}'); } catch { return { status: 400, body: { error: 'JSON inválido' } }; }
      if (!t.Drv_Id || !t.Truck || !t.Origin || !t.Destination || !t.OperaPon) return { status: 400, body: { error: 'viaje incompleto' } };
      await store.setTrip(t.Drv_Id, { ...t, Tripdt: new Date().toISOString() });
      return { status: 200, body: { ok: true } };
    }
    case 'POST UpdateFCM': return { status: 200, body: { ok: true } };
    default: return { status: 404, body: { error: 'no existe' } };
  }
}
