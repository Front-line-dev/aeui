import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { beforeAll, it, expect } from 'vitest';
import { root } from '../conformance/check.mjs';

let temp, consumer, coreTar, cliTar, packed;
const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
function node(args, cwd = consumer, accepted = [0]) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 110000, env: { ...process.env, NODE_PATH: '' } });
  if (result.error || !accepted.includes(result.status)) throw new Error(`${args[0]}: ${result.error || result.stderr || result.stdout}`);
  return result;
}
function install(cwd) { node([npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], cwd); }

beforeAll(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aeui-consumer-'));
  fs.mkdirSync(path.join(root, '.conformance'), { recursive: true });
  // runner가 브라우저 검증 후 정리한다. 저장소 밖에서 workspace 해석 없이 설치한다.
  write(path.join(root, '.conformance/extra-context.json'), { temp, project: path.join(temp, 'project') });
  packed = JSON.parse(node([npm, 'pack', '--workspace', 'a-easy-ui', '--workspace', 'create-aeui-app', '--ignore-scripts', '--json', '--pack-destination', temp], root).stdout);
  coreTar = path.join(temp, packed.find(item => item.name === 'a-easy-ui').filename);
  cliTar = path.join(temp, packed.find(item => item.name === 'create-aeui-app').filename);
  consumer = path.join(temp, 'consumer'); fs.mkdirSync(consumer);
  write(path.join(consumer, 'package.json'), { private: true, type: 'module', dependencies: {
    aeui: `file:${coreTar}`, 'create-aeui-app': `file:${cliTar}`,
    typescript: read(path.join(root, 'node_modules/typescript/package.json')).version,
    '@types/node': read(path.join(root, 'node_modules/@types/node/package.json')).version,
    vite: read(path.join(root, 'node_modules/vite/package.json')).version,
  } });
  install(consumer);
});

it('[CONFIG-PACKAGE.10] 실제 tarball의 ESM·CJS 세 진입점은 로딩되며 private subpath는 열리지 않는다', () => {
  expect(fs.lstatSync(path.join(consumer, 'node_modules/aeui')).isSymbolicLink()).toBe(false);
  for (const format of ['module', 'commonjs']) {
    const script = format === 'module' ? `
      import assert from 'node:assert/strict';
      import * as api from 'aeui'; import babel from 'aeui/babel-plugin'; import vite from 'aeui/vite';
      assert.deepEqual(Object.keys(api).sort(), ['AEUI','clean','watch']);
      assert.equal(typeof babel, 'function'); assert.equal(typeof vite, 'function');
      assert.equal(api.AEUI.createElement('p', null, 'ok').children[0], 'ok');
      await assert.rejects(import('aeui/src/index.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    ` : `
      const assert = require('node:assert/strict'), api = require('aeui');
      assert.deepEqual(Object.keys(api).sort(), ['AEUI','clean','watch']);
      assert.equal(typeof require('aeui/babel-plugin'), 'function');
      assert.equal(typeof require('aeui/vite'), 'function');
      assert.throws(() => require('aeui/src/index.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    `;
    node(['--input-type=' + format, '-e', script]);
  }
  for (const artifact of packed) {
    expect(artifact.files.some(file => /(^|\/)\.DS_Store$/.test(file.path))).toBe(false);
    expect(artifact.files.every(file => !path.isAbsolute(file.path) && !file.path.split('/').includes('..'))).toBe(true);
    const directory = artifact.name === 'a-easy-ui' ? 'core' : 'create-aeui-app';
    const manifest = read(path.join(root, 'packages', directory, 'package.json'));
    const actualFiles = artifact.files.map(file => file.path);
    for (const declared of manifest.files) {
      expect(actualFiles.some(file => file === declared || file.startsWith(declared + '/')), `누락된 files 항목: ${declared}`).toBe(true);
    }
    expect(actualFiles.filter(file => !manifest.files.some(declared => file === declared || file.startsWith(declared + '/')) && !/^(package\.json|readme(?:\..*)?|licen[sc]e(?:\..*)?)$/i.test(file))).toEqual([]);
  }
});

it('[INTERNAL-PACKAGE.10] 독립 strict NodeNext에서 공개 타입은 통과하고 잘못된 훅·태그 인자는 거부한다', () => {
  fs.writeFileSync(path.join(consumer, 'contract.ts'), `
    import { AEUI, watch, clean } from 'aeui';
    import babel from 'aeui/babel-plugin'; import vite from 'aeui/vite';
    const vnode = AEUI.createElement('button', { onClick: (e: Event) => e.preventDefault() }, 'ok');
    watch(() => {}, () => [vnode]); clean(() => {}); vite({ rootId: 'app', styles: false }); void babel;
    // @ts-expect-error callback은 함수여야 한다.
    watch(3);
    // @ts-expect-error cleanup도 함수여야 한다.
    clean('bad');
    // @ts-expect-error 숫자는 태그가 아니다.
    AEUI.createElement(42);
  `);
  write(path.join(consumer, 'tsconfig.json'), { compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2020', lib: ['ES2020', 'DOM', 'ESNext.Disposable'], skipLibCheck: false }, files: ['contract.ts'] });
  node(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
});

it('[START-CLI.10] 배포 CLI는 문서의 router 프로젝트를 생성하고 설치·빌드되며 수동 main을 요구하지 않는다', () => {
  const cli = path.join(consumer, 'node_modules/create-aeui-app/index.js');
  node([cli, 'project'], temp);
  const project = path.join(temp, 'project');
  for (const file of ['.gitignore', 'index.html', 'jsconfig.json', 'package.json', 'vite.config.js', 'src/pages/index.jsx', 'src/pages/about.jsx', 'src/pages/products/[id].jsx']) {
    expect(fs.existsSync(path.join(project, file)), file).toBe(true);
  }
  const manifest = read(path.join(project, 'package.json'));
  expect(manifest.name).toBe('project');
  expect(manifest.dependencies.aeui).toBe(`npm:a-easy-ui@${packed.find(item => item.name === 'a-easy-ui').version}`);
  expect(Object.keys(manifest.scripts).sort()).toEqual(['build', 'dev', 'preview']);
  expect(fs.existsSync(path.join(project, 'src/main.js'))).toBe(false);
  // 생성된 alias 버전을 확인한 뒤 검증 대상 tarball로만 대체한다. registry의 다른 버전을 검증하지 않는다.
  manifest.dependencies.aeui = `file:${coreTar}`;
  manifest.devDependencies.vite = read(path.join(root, 'node_modules/vite/package.json')).version;
  write(path.join(project, 'package.json'), manifest);
  install(project);
  node([npm, 'run', 'build'], project);
  expect(fs.readFileSync(path.join(project, 'dist/index.html'), 'utf8')).toMatch(/<script[^>]+type="module"/);
});

it('[INTERNAL-PACKAGE.11] CLI의 잘못된 인자와 기존 디렉터리는 실패하며 파일을 생성하거나 덮어쓰지 않는다', () => {
  const cli = path.join(consumer, 'node_modules/create-aeui-app/index.js');
  const sandbox = path.join(temp, 'invalid'); fs.mkdirSync(sandbox);
  fs.mkdirSync(path.join(sandbox, 'existing'));
  fs.writeFileSync(path.join(sandbox, 'existing/keep'), 'sentinel');
  for (const args of [[], ['../escape'], ['invalid name'], ['one', 'two'], ['existing']]) {
    node([cli, ...args], sandbox, [1]);
    expect(fs.readdirSync(sandbox)).toEqual(['existing']);
    expect(fs.readFileSync(path.join(sandbox, 'existing/keep'), 'utf8')).toBe('sentinel');
  }
  node([cli, '--help'], sandbox);
  expect(fs.readdirSync(sandbox)).toEqual(['existing']);
  expect(fs.existsSync(path.join(temp, 'escape'))).toBe(false);
});
