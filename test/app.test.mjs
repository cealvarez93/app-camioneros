import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createMock } from '../server/mock.mjs';
import { buildQrPayload } from '../src/qr.js';

test('QR con el formato de la app actual', () => {
  const trip = { Truck: 'AB1234', Destination: 'Temuco', OperaPon: 'Carga', Pallet: '24' };
  assert.equal(buildQrPayload('11111111-1', trip, new Date(2026, 9, 26)), 'ENV;11111111-1;AB1234;Temuco;C;24;20261026;SbI');
});

test('flujo completo contra la API simulada', async () => {
  const srv = createMock();
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}/api_final/api/dal/`;
  const j = async (p, init) => { const r = await fetch(base + p, init); const t = await r.text(); return { s: r.status, b: t ? JSON.parse(t) : null }; };
  try {
    assert.equal((await j('GetLoginUser?user=11111111-1&password=mala')).s, 404);
    const login = await j('GetLoginUser?user=11111111-1&password=demo');
    assert.equal(login.s, 200);
    const id = login.b.Drv_Id;
    assert.equal((await j(`GetDriverProfile?drvId=${id}`)).b.Drv_Password, undefined);
    assert.equal((await j(`GetTripByDrvId?DrvId=${id}`)).b, null);
    const trip = { Drv_Id: id, Origin: 'CD Maipú', Destination: 'Temuco', Truck: 'AB1234', Trailer: 'CD5678', Pallet: '24', OperaPon: 'Carga' };
    assert.equal((await j('SaveTrip', { method: 'POST', body: JSON.stringify({ ...trip, Truck: '' }) })).s, 400);
    assert.equal((await j('SaveTrip', { method: 'POST', body: JSON.stringify(trip) })).s, 200);
    assert.equal((await j(`GetTripByDrvId?DrvId=${id}`)).b.Truck, 'AB1234');
    for (const p of ['GetOrigenLocations', 'GetDestinosLocations', 'GetOperations']) assert.ok((await j(p)).b.length > 0);
    assert.equal((await j('GetClockingTiming')).b.QuantityTrucks, 3);
  } finally { srv.close(); }
});

test('el código fuente no referencia la IP de producción', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk('src'), ...walk('server'), 'vite.config.js', 'capacitor.config.json', '.env.example'].filter((f) => /\.(jsx?|mjs|json|example)$/.test(f));
  for (const f of files) assert.ok(!readFileSync(f, 'utf8').includes('44.199.164.222'), `${f} referencia producción`);
});
