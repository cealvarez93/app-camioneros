// Formato del QR que lee el portero: idéntico al de la app Xamarin (Arrival).
// ENV;{RUT};{patente tracto};{destino};{inicial de la operación};{pallets};{yyyyMMdd};SbI
export function buildQrPayload(userId, trip, now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  return `ENV;${userId};${trip.Truck};${trip.Destination};${String(trip.OperaPon).substring(0, 1)};${trip.Pallet};${ymd};SbI`;
}
