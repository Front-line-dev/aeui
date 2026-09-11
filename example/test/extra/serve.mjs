import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, preview } from 'vite';
import { root } from '../conformance/check.mjs';

const [name, portText] = process.argv.slice(2);
const port = Number(portText);
if (name === 'cli' || name === 'cli-dev') {
  const { project } = JSON.parse(fs.readFileSync(path.join(root, '.conformance/extra-context.json'), 'utf8'));
  // 소비 프로젝트가 설치한 Vite로 preview한다. 저장소의 Vite/source로 우회하지 않는다.
  const vite = await import(pathToFileURL(path.join(project, 'node_modules/vite/dist/node/index.js')));
  if (name === 'cli-dev') {
    const server = await vite.createServer({ root: project, server: { host: '127.0.0.1', port, strictPort: true } });
    await server.listen();
  } else {
    await vite.preview({ root: project, preview: { host: '127.0.0.1', port, strictPort: true } });
  }
} else {
  if (!['commerce-admin', 'vite-demo', 'deep-compare-test', 'letProps', 'shoppingCart'].includes(name)) throw new Error('Unknown reference app');
  const appRoot = path.join(root, 'example', name);
  await build({ root: appRoot, logLevel: 'warn' });
  await preview({ root: appRoot, preview: { host: '127.0.0.1', port, strictPort: true } });
}
