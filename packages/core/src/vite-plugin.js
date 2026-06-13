import fs from 'node:fs';
import path from 'node:path';
import { transformAsync } from '@babel/core';
import jsxTransform from '@babel/plugin-transform-react-jsx';
import aeuiTransform from './babel-plugin.js';

const VIRTUAL_ENTRY_ID = 'virtual:aeui-entry';
const PUBLIC_ENTRY_PATH = '/@aeui-entry';
const RESOLVED_VIRTUAL_ENTRY_ID = `\0${VIRTUAL_ENTRY_ID}`;
const ROUTE_EXT_RE = /\.jsx$/;
const DEFAULT_ROUTER_DIR = 'src/pages';

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function hasManualModuleEntry(html) {
  return /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'][^"']*\/src\/main\.[^"']*["'][^>]*>/i.test(html);
}

function hasFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function hasRouteFile(dir) {
  if (!fs.existsSync(dir)) return false;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && hasRouteFile(entryPath)) return true;
    if (entry.isFile() && ROUTE_EXT_RE.test(entry.name)) return true;
  }

  return false;
}

function createStyleImport(root, styleEntry) {
  if (styleEntry === false) return '';

  const stylePath = styleEntry || 'src/styles.css';
  const absoluteStylePath = path.resolve(root, stylePath);
  if (!hasFile(absoluteStylePath)) return '';

  return `import "/${normalizePath(path.relative(root, absoluteStylePath))}";`;
}

function createRouterEntry(root, options) {
  const normalizedRouterDir = DEFAULT_ROUTER_DIR;
  const absoluteRouterDir = path.resolve(root, normalizedRouterDir);
  const styleImport = createStyleImport(root, options.styles);
  const rootId = options.rootId || 'root';

  if (hasRouteFile(absoluteRouterDir)) {
    return `
      import { AEUI } from "aeui";
      ${styleImport}

      const routes = import.meta.glob("/${normalizedRouterDir}/**/*.jsx", { eager: true });
      AEUI.__runtime.initDirectoryRouter(routes, document.getElementById(${JSON.stringify(rootId)}), {
        rootDir: "/${normalizedRouterDir}"
      });
    `;
  }

  const appEntry = options.appEntry || 'src/App.jsx';
  const absoluteAppEntry = path.resolve(root, appEntry);
  const normalizedAppEntry = normalizePath(path.relative(root, absoluteAppEntry));

  return `
    import { AEUI } from "aeui";
    import App from "/${normalizedAppEntry}";
    ${styleImport}

    AEUI.init(App, document.getElementById(${JSON.stringify(rootId)}));
  `;
}

function shouldTransform(id) {
  const filePath = id.split('?')[0];
  if (!/\.jsx$/.test(filePath)) return false;
  if (filePath.includes('/node_modules/')) return false;
  return true;
}

export default function aeui(options = {}) {
  let root = process.cwd();

  return {
    name: 'aeui:vite',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (html.includes(VIRTUAL_ENTRY_ID) || hasManualModuleEntry(html)) {
          return html;
        }

        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module', src: PUBLIC_ENTRY_PATH },
              injectTo: 'body',
            },
          ],
        };
      },
    },

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID || id === PUBLIC_ENTRY_PATH) return RESOLVED_VIRTUAL_ENTRY_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ENTRY_ID) return null;
      return createRouterEntry(root, options);
    },

    async transform(code, id) {
      if (!shouldTransform(id)) return null;

      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: id.split('?')[0],
        plugins: [
          aeuiTransform,
          [jsxTransform, {
            pragma: 'AEUI.createElement',
            pragmaFrag: 'AEUI.Fragment',
          }],
        ],
        sourceMaps: true,
      });

      return result ? { code: result.code, map: result.map } : null;
    },
  };
}
