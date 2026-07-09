import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import aeuiVite from '../../../../packages/core/src/vite-plugin.js';
import {
  createRouteTable,
  matchRoute,
  shouldHandleAnchorClick,
} from '../../../../packages/core/src/router.js';

function HomePage() {}
function AboutPage() {}
function ProductPage() {}
function CatchAllPage() {}
function NotFoundPage() {}
function DocsIndexPage() {}

describe('directory router route matching', () => {
  it('matches static, index, dynamic, catch-all, fallback, and query values', () => {
    const table = createRouteTable({
      '/src/pages/index.jsx': { default: HomePage },
      '/src/pages/about.jsx': { default: AboutPage },
      '/src/pages/products/[id].jsx': { default: ProductPage },
      '/src/pages/docs/[...slug].jsx': { default: CatchAllPage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    expect(matchRoute(table, '/').component).toBe(HomePage);
    expect(matchRoute(table, '/about').component).toBe(AboutPage);

    const product = matchRoute(table, '/products/p-1?tab=details&tag=a&tag=b');
    expect(product.component).toBe(ProductPage);
    expect(product.route.params).toEqual({ id: 'p-1' });
    expect(product.route.query).toEqual({ tab: 'details', tag: ['a', 'b'] });

    const docs = matchRoute(table, '/docs/core/router');
    expect(docs.component).toBe(CatchAllPage);
    expect(docs.route.params).toEqual({ slug: ['core', 'router'] });

    const missing = matchRoute(table, '/missing');
    expect(missing.component).toBe(NotFoundPage);
    expect(missing.isFallback).toBe(true);
  });

  it('accepts the documented route file extensions consistently', () => {
    function JsPage() {}
    function TsPage() {}
    function TsxPage() {}
    function MjsPage() {}
    function CjsPage() {}
    const table = createRouteTable({
      '/src/pages/about.js': { default: JsPage },
      '/src/pages/settings.ts': { default: TsPage },
      '/src/pages/profile.tsx': { default: TsxPage },
      '/src/pages/feed.mjs': { default: MjsPage },
      '/src/pages/legacy.cjs': { default: CjsPage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    expect(matchRoute(table, '/about').component).toBe(JsPage);
    expect(matchRoute(table, '/settings').component).toBe(TsPage);
    expect(matchRoute(table, '/profile').component).toBe(TsxPage);
    expect(matchRoute(table, '/feed').component).toBe(MjsPage);
    expect(matchRoute(table, '/legacy').component).toBe(CjsPage);
  });

  it('prioritizes static routes over dynamic routes', () => {
    const StaticPage = () => null;
    const DynamicPage = () => null;
    const table = createRouteTable({
      '/src/pages/products/[id].jsx': { default: DynamicPage },
      '/src/pages/products/new.jsx': { default: StaticPage },
    });

    expect(matchRoute(table, '/products/new').component).toBe(StaticPage);
    expect(matchRoute(table, '/products/123').component).toBe(DynamicPage);
  });

  it('keeps index routes ahead of catch-all routes for empty remainders', () => {
    const table = createRouteTable({
      '/src/pages/index.jsx': { default: HomePage },
      '/src/pages/docs/index.jsx': { default: DocsIndexPage },
      '/src/pages/docs/[...slug].jsx': { default: CatchAllPage },
      '/src/pages/[...slug].jsx': { default: CatchAllPage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    expect(matchRoute(table, '/').component).toBe(HomePage);
    expect(matchRoute(table, '/docs').component).toBe(DocsIndexPage);

    const nested = matchRoute(table, '/docs/core/router');
    expect(nested.component).toBe(CatchAllPage);
    expect(nested.route.params).toEqual({ slug: ['core', 'router'] });
  });

  it('falls back instead of throwing when dynamic params cannot be decoded', () => {
    const table = createRouteTable({
      '/src/pages/products/[id].jsx': { default: ProductPage },
      '/src/pages/docs/[...slug].jsx': { default: CatchAllPage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    const malformedDynamic = matchRoute(table, '/products/%E0%A4%A');
    expect(malformedDynamic.component).toBe(NotFoundPage);
    expect(malformedDynamic.isFallback).toBe(true);

    const malformedCatchAll = matchRoute(table, '/docs/core/%E0%A4%A');
    expect(malformedCatchAll.component).toBe(NotFoundPage);
    expect(malformedCatchAll.isFallback).toBe(true);
  });

  it('matches static path segments after URL decoding', () => {
    function CafePage() {}
    const table = createRouteTable({
      '/src/pages/café.jsx': { default: CafePage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    expect(matchRoute(table, '/café').component).toBe(CafePage);
    expect(matchRoute(table, '/caf%C3%A9').component).toBe(CafePage);
  });

  it('ignores catch-all routes that are not the final segment', () => {
    function InvalidCatchAllPage() {}
    const table = createRouteTable({
      '/src/pages/[...slug]/edit.jsx': { default: InvalidCatchAllPage },
      '/src/pages/404.jsx': { default: NotFoundPage },
    });

    expect(table.routes.map((route) => route.filePath)).not.toContain('/src/pages/[...slug]/edit.jsx');
    expect(matchRoute(table, '/foo/edit').component).toBe(NotFoundPage);
    expect(matchRoute(table, '/foo/bar/edit').component).toBe(NotFoundPage);
  });
});

describe('directory router anchor interception', () => {
  it('handles same-origin internal anchor clicks', () => {
    window.history.replaceState({}, '', '/');
    const anchor = document.createElement('a');
    anchor.href = '/cart';

    const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true });

    expect(shouldHandleAnchorClick(event, anchor)).toBe(true);
  });

  it('leaves external, modified, download, and new-tab clicks to the browser', () => {
    const internal = document.createElement('a');
    internal.href = '/cart';

    const external = document.createElement('a');
    external.href = 'https://example.com/cart';

    const download = document.createElement('a');
    download.href = '/invoice.pdf';
    download.setAttribute('download', '');

    const newTab = document.createElement('a');
    newTab.href = '/cart';
    newTab.target = '_blank';

    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0, metaKey: true }), internal)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 1 }), internal)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), external)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), download)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), newTab)).toBe(false);
  });
});

describe('aeui/vite plugin', () => {
  const tempDirs = [];

  afterEach(() => {
    while (tempDirs.length) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  function makeFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeui-vite-'));
    tempDirs.push(dir);
    return dir;
  }

  it('injects a hidden virtual entry when index.html has no manual main script', () => {
    const plugin = aeuiVite();
    plugin.configResolved({ root: makeFixture() });

    const result = plugin.transformIndexHtml.handler('<html><body><div id="root"></div></body></html>');

    expect(result.tags[0].attrs.src).toBe('/@aeui-entry');
  });

  it('keeps manual main entries untouched regardless of script attribute order', () => {
    const plugin = aeuiVite();
    const manualEntries = [
      '<script type="module" src="/src/main.js"></script>',
      '<script src="/src/main.js" type="module"></script>',
      '<script src="/base/src/main.js" type="module"></script>',
      '<script defer src="/src/main.jsx" type="module"></script>',
      '<script type="module" src="./src/main.js?version=1#entry"></script>',
    ];

    manualEntries.forEach((script) => {
      const html = `<html><body>${script}</body></html>`;
      expect(plugin.transformIndexHtml.handler(html)).toBe(html);
    });
  });

  it('does not treat data attributes as manual main script attributes', () => {
    const plugin = aeuiVite();
    plugin.configResolved({ root: makeFixture() });

    const result = plugin.transformIndexHtml.handler(
      '<html><body><script data-src="/src/main.js" data-type="module"></script></body></html>'
    );

    expect(result.tags[0].attrs.src).toBe('/@aeui-entry');
  });

  it('provides @ as a default alias to src', () => {
    const root = makeFixture();
    const plugin = aeuiVite();

    const config = plugin.config({ root });

    expect(config.resolve.alias['@']).toBe(path.join(root, 'src'));
  });

  it('does not override an existing @ alias', () => {
    const root = makeFixture();
    const plugin = aeuiVite();

    const config = plugin.config({
      root,
      resolve: {
        alias: {
          '@': path.join(root, 'custom-src'),
        },
      },
    });

    expect(config).toBe(null);
  });

  it('generates router bootstrap code when src/pages contains route files', () => {
    const root = makeFixture();
    fs.mkdirSync(path.join(root, 'src/pages'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/pages/index.tsx'), 'export default function Home() {}');

    const plugin = aeuiVite();
    plugin.configResolved({ root });

    const entry = plugin.load('\0virtual:aeui-entry');

    expect(entry).toContain('AEUI.__runtime.initDirectoryRouter');
    expect(entry).toContain('import.meta.glob("/src/pages/**/*.{js,jsx,ts,tsx,mjs,cjs}"');
  });

  it('transforms JSX and TSX route modules before Vite handles the rest of the pipeline', async () => {
    const plugin = aeuiVite();

    const jsx = await plugin.transform('export default () => <div />;', '/app/src/pages/index.jsx');
    const tsx = await plugin.transform(
      'const title: string = "Home"; export default function Home(): unknown { return <h1>{title}</h1>; }',
      '/app/src/pages/index.tsx'
    );
    const ts = await plugin.transform(
      'import { AEUI } from "aeui"; export function Home(): unknown { return AEUI.createVNode("h1", null, "Home"); }',
      '/app/src/pages/home.ts'
    );

    expect(jsx.code).toContain('AEUI.createElement("div"');
    expect(tsx.code).toContain('AEUI.createElement("h1"');
    expect(ts.code).toContain('AEUI.__runtime.runRenderPhase');
  });
});
