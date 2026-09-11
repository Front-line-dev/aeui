// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, it, expect } from 'vitest';
import plugin from 'aeui/vite';

const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aeui-contract-'));
  dirs.push(root);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

it('[CONFIG-OPTIONS.10] alias 기본값·사용자 경로·false를 적용하고 끈 별칭을 추가하지 않는다', () => {
  const root = fixture();
  expect(plugin().config({ root }).resolve.alias['@']).toBe(path.join(root, 'src'));
  expect(plugin({ alias: '~', aliasDir: 'views' }).config({ root }).resolve.alias).toEqual({ '~': path.join(root, 'views') });
  expect(plugin({ alias: false }).config({ root })).toBeNull();
});

it('[CONFIG-OPTIONS.11] single-app의 appEntry·rootId를 적용하고 styles:false의 CSS를 주입하지 않는다', () => {
  const root = fixture({ 'views/Main.jsx': 'export default () => null;', 'src/styles.css': 'body{}' });
  const p = plugin({ appEntry: 'views/Main.jsx', rootId: 'app', styles: false });
  p.configResolved({ root });
  const code = p.load(p.resolveId('/@aeui-entry'));
  expect(code).toContain('/views/Main.jsx');
  expect(code).toContain('getElementById("app")');
  expect(code).not.toContain('styles.css');
  expect(code).not.toContain('initDirectoryRouter');
});

it.each([false, true])('[CONFIG-ENTRY.10] route 파일 존재=%s에 따라 모드를 선택하고 두 bootstrap을 함께 만들지 않는다', hasRoute => {
  const root = fixture(hasRoute ? { 'src/pages/index.jsx': 'export default () => null;' } : { 'src/App.jsx': 'export default () => null;' });
  const p = plugin(); p.configResolved({ root });
  const code = p.load(p.resolveId('/@aeui-entry'));
  expect(code.includes('initDirectoryRouter')).toBe(hasRoute);
  expect(code.includes('/src/App.jsx')).toBe(!hasRoute);
  const html = p.transformIndexHtml.handler('<html><body><div id="root"></div></body></html>');
  expect(html.tags.filter(tag => tag.attrs?.type === 'module')).toHaveLength(1);
});

it('[INTERNAL-COMPILER.11] 가짜 script 문자열은 진입점 주입을 막지 않고 실제 수동 main에는 중복 주입하지 않는다', () => {
  const p = plugin(); p.configResolved({ root: fixture() });
  const fake = '<!-- <script type="module" src="/src/main.js"></script> -->';
  expect(p.transformIndexHtml.handler(fake).tags).toHaveLength(1);
  const manual = '<script src="/src/main.js" type="module"></script>';
  expect(p.transformIndexHtml.handler(manual)).toBe(manual);
});
