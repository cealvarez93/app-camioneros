// API simulada de QA como Cloudflare Pages Function. El deploy de producción elimina functions/.
import { handle, kvStore, memoryStore } from '../../../../server/mockCore.mjs';

const memoria = memoryStore();

export async function onRequest({ request, env }) {
  const store = env.TRIPS ? kvStore(env.TRIPS) : memoria;
  const bodyText = request.method === 'POST' ? await request.text() : '';
  const { status, body } = await handle({ method: request.method, url: request.url, bodyText }, store);
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
