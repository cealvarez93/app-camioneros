// Servidor local de la API simulada. Datos en memoria.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { handle, memoryStore } from './mockCore.mjs';

export function createMock() {
  const store = memoryStore();
  return http.createServer(async (req, res) => {
    let bodyText = '';
    if (req.method === 'POST') for await (const c of req) bodyText += c;
    const { status, body } = await handle({ method: req.method, url: req.url, bodyText }, store);
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  createMock().listen(port, '127.0.0.1', () => console.log(`API simulada en http://127.0.0.1:${port}  (usuario 11111111-1 / clave demo)`));
}
