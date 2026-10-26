// Publica dist/version.json con el commit y el ambiente; el smoke lo compara con el commit desplegado.
import { writeFileSync } from 'node:fs';

const version = { sha: process.env.APP_SHA || process.env.GITHUB_SHA || 'local', env: process.env.APP_ENV || 'local', build: new Date().toISOString() };
writeFileSync('dist/version.json', JSON.stringify(version));
console.log(`version.json: ${version.env} ${version.sha.slice(0, 7)}`);
