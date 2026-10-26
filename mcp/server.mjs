// MCP por stdio. Variables: GITHUB_TOKEN (fine-grained, un repo), GITHUB_REPO (owner/nombre), QA_URL, PROD_URL, GITHUB_API (opcional).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createGithub } from './github.mjs';
import { Rechazo } from './policy.mjs';
import * as tools from './tools.mjs';

const { GITHUB_TOKEN, GITHUB_REPO, QA_URL, PROD_URL, GITHUB_API } = process.env;
if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('Faltan GITHUB_TOKEN y GITHUB_REPO');
  process.exit(1);
}

const gh = createGithub({ token: GITHUB_TOKEN, repo: GITHUB_REPO, api: GITHUB_API });
const login = (await gh.user()).login;
const ctx = { gh, login, qaUrl: QA_URL, prodUrl: PROD_URL };

const responder = (fn) => async (args) => {
  try {
    const out = await fn(args);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: out?.estado === 'CONFLICTO' };
  } catch (e) {
    const estado = e instanceof Rechazo ? e.estado : 'ERROR';
    return { content: [{ type: 'text', text: JSON.stringify({ estado, mensaje: e.message }) }], isError: true };
  }
};

const server = new McpServer({ name: 'logistic', version: '1.0.0' });

server.registerTool('get_status', { description: 'Commit de qa y main, commit desplegado por ambiente, PRs abiertos con CI/smoke/aprobación, últimos eventos y reglas. Abre la sesión con esto.' }, responder(() => tools.getStatus(ctx)));

server.registerTool('fetch_file', {
  description: 'Contenido, base_commit y blob de un archivo, o la lista de un directorio. ref por defecto: qa.',
  inputSchema: { path: z.string(), ref: z.string().optional() },
}, responder((a) => tools.fetchFile(ctx, a)));

server.registerTool('propose_change', {
  description: 'Crea la rama claudia/<usuario>/<tema>, hace commit y abre PR hacia qa con auto-merge cuando CI queda verde. Solo rutas src/, public/, test/, docs/, bitacora.md. cambio: {reemplazar:{old,new}} | {crear:{contenido}} | {reescribir:{contenido}}.',
  inputSchema: { path: z.string(), cambio: z.record(z.string(), z.any()), base_commit: z.string(), tema: z.string(), decision: z.string() },
}, responder((a) => tools.proposeChange(ctx, a)));

server.registerTool('validar_qa', {
  description: 'Aprueba el PR de promoción qa → main tras probar QA. Exige ci y smoke-qa verdes sobre el commit que sirve QA.',
  inputSchema: { pr_number: z.number().int(), decision: z.string() },
}, responder((a) => tools.validarQa(ctx, a)));

server.registerTool('rollback', {
  description: 'Redespliega producción al último commit bueno (tag prod-ok).',
  inputSchema: { decision: z.string() },
}, responder((a) => tools.rollback(ctx, a)));

await server.connect(new StdioServerTransport());
