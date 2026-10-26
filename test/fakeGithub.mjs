// GitHub falso en memoria con los endpoints que usa el MCP.
import http from 'node:http';
import { createHash } from 'node:crypto';

const blob = (t) => createHash('sha1').update(t).digest('hex');
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');

export function crearFake({ login = 'hermano', archivos = { 'src/App.jsx': 'const a = 1;\nconst b = 2;\n', 'src/otro.js': 'x' } } = {}) {
  const s = { n: 0, snaps: {}, ramas: {}, prs: [], reviews: {}, checks: {}, dispatches: [], graphql: [], graphqlError: null, commits: [] };
  const nuevoCommit = (files) => { const sha = `c${++s.n}`.padEnd(8, '0'); s.snaps[sha] = { ...files }; return sha; };
  s.ramas.qa = nuevoCommit(archivos);
  s.ramas.main = nuevoCommit(archivos);

  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const data = body ? JSON.parse(body) : {};
    const u = new URL(req.url, 'http://x');
    const p = decodeURIComponent(u.pathname);
    const out = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
    const m = (re) => p.match(re);
    let x;
    if (p === '/user') return out(200, { login });
    if (p === '/graphql') { s.graphql.push(data.variables); return out(200, s.graphqlError ? { errors: [{ message: s.graphqlError }] } : { data: {} }); }
    if ((x = m(/^\/repos\/o\/r\/branches\/(.+)$/))) return s.ramas[x[1]] ? out(200, { name: x[1], commit: { sha: s.ramas[x[1]] } }) : out(404, { message: 'Not Found' });
    if ((x = m(/^\/repos\/o\/r\/git\/ref\/heads\/(.+)$/))) return s.ramas[x[1]] ? out(200, { object: { sha: s.ramas[x[1]] } }) : out(404, { message: 'Not Found' });
    if (p === '/repos/o/r/git/refs' && req.method === 'POST') { s.ramas[data.ref.replace('refs/heads/', '')] = data.sha; return out(201, {}); }
    if ((x = m(/^\/repos\/o\/r\/contents\/(.+)$/))) {
      const ruta = x[1];
      if (req.method === 'GET') {
        const files = s.snaps[s.ramas[u.searchParams.get('ref')]];
        if (!files) return out(404, { message: 'Not Found' });
        if (files[ruta] !== undefined) return out(200, { type: 'file', sha: blob(files[ruta]), content: b64(files[ruta]) });
        const hijos = Object.keys(files).filter((f) => f.startsWith(ruta + '/'));
        return hijos.length ? out(200, hijos.map((f) => ({ name: f.split('/').pop(), type: 'file' }))) : out(404, { message: 'Not Found' });
      }
      const files = { ...s.snaps[s.ramas[data.branch]] };
      if (files[ruta] !== undefined && data.sha !== blob(files[ruta])) return out(409, { message: 'sha no coincide' });
      files[ruta] = Buffer.from(data.content, 'base64').toString('utf8');
      const sha = nuevoCommit(files); s.ramas[data.branch] = sha; s.commits.push({ sha, message: data.message, branch: data.branch });
      return out(200, { commit: { sha }, content: { sha: blob(files[ruta]) } });
    }
    if ((x = m(/^\/repos\/o\/r\/compare\/(.+)\.\.\.(.+)$/))) {
      const a = s.snaps[x[1]]; const b = s.snaps[x[2]];
      if (!a || !b) return out(404, { message: 'Not Found' });
      const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
      return out(200, { files: [...claves].filter((k) => a[k] !== b[k]).map((k) => ({ filename: k })) });
    }
    if (p === '/repos/o/r/pulls' && req.method === 'GET') {
      const head = u.searchParams.get('head');
      return out(200, s.prs.filter((r) => r.state === 'open' && (!head || `o:${r.head.ref}` === head)));
    }
    if (p === '/repos/o/r/pulls' && req.method === 'POST') {
      const pr = { number: s.prs.length + 1, node_id: `PR_${s.prs.length + 1}`, state: 'open', title: data.title, body: data.body, head: { ref: data.head, sha: s.ramas[data.head] }, base: { ref: data.base }, user: { login }, auto_merge: null };
      s.prs.push(pr); return out(201, pr);
    }
    if ((x = m(/^\/repos\/o\/r\/pulls\/(\d+)$/))) {
      const pr = s.prs[Number(x[1]) - 1]; if (!pr) return out(404, { message: 'Not Found' });
      if (req.method === 'PATCH') Object.assign(pr, data);
      pr.head.sha = s.ramas[pr.head.ref];
      return out(200, pr);
    }
    if ((x = m(/^\/repos\/o\/r\/pulls\/(\d+)\/files$/))) {
      const pr = s.prs[Number(x[1]) - 1]; const base = s.snaps[s.ramas[pr.base.ref]]; const head = s.snaps[s.ramas[pr.head.ref]];
      return out(200, Object.keys(head).filter((k) => base[k] !== head[k]).map((k) => ({ filename: k })));
    }
    if ((x = m(/^\/repos\/o\/r\/pulls\/(\d+)\/reviews$/))) {
      const n = x[1]; s.reviews[n] ??= [];
      if (req.method === 'POST') { s.reviews[n].push({ user: { login }, state: data.event === 'APPROVE' ? 'APPROVED' : 'COMMENTED', body: data.body, commit_id: data.commit_id }); return out(200, {}); }
      return out(200, s.reviews[n]);
    }
    if ((x = m(/^\/repos\/o\/r\/commits\/([^/]+)\/check-runs$/))) {
      const sha = x[1] === 'qa' ? s.ramas.qa : x[1];
      return out(200, { check_runs: Object.entries(s.checks[sha] || {}).map(([name, conclusion]) => ({ name, status: 'completed', conclusion })) });
    }
    if (p === '/repos/o/r/commits') return out(200, [...s.commits].reverse().slice(0, 8).map((c) => ({ sha: c.sha, commit: { author: { name: login, date: '2026-10-26T00:00:00Z' }, message: c.message } })));
    if (p === '/repos/o/r/actions/workflows/rollback.yml/dispatches') { s.dispatches.push(data); return out(204); }
    return out(404, { message: `sin ruta ${req.method} ${p}` });
  });
  return { s, server, abrir: () => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`))) };
}
