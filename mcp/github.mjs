// Cliente mínimo de la API REST/GraphQL de GitHub.
export class GithubError extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

export function createGithub({ token, repo, api = 'https://api.github.com' }) {
  async function raw(method, ruta, body) {
    const r = await fetch(api + ruta, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'logistic-mcp',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return null;
    const t = await r.text();
    const j = t ? JSON.parse(t) : null;
    if (!r.ok) throw new GithubError(r.status, `${method} ${ruta} → ${r.status} ${j?.message ?? ''}`.trim());
    return j;
  }
  const repoCall = (method, ruta, body) => raw(method, `/repos/${repo}${ruta}`, body);
  return {
    repo,
    user: () => raw('GET', '/user'),
    get: (ruta) => repoCall('GET', ruta),
    post: (ruta, body) => repoCall('POST', ruta, body),
    put: (ruta, body) => repoCall('PUT', ruta, body),
    patch: (ruta, body) => repoCall('PATCH', ruta, body),
    graphql: (query, variables) => raw('POST', '/graphql', { query, variables }),
  };
}
