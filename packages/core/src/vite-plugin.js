import fs from 'node:fs';
import path from 'node:path';
import { transformAsync } from '@babel/core';
import jsxTransform from '@babel/plugin-transform-react-jsx';
import aeuiTransform from './babel-plugin.js';
import { parse } from 'parse5';

const VIRTUAL_ENTRY_ID = 'virtual:aeui-entry';
const PUBLIC_ENTRY_PATH = '/@aeui-entry';
const RESOLVED_VIRTUAL_ENTRY_ID = `\0${VIRTUAL_ENTRY_ID}`;
const ROUTE_EXT_RE = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/;
const ROUTE_GLOB_EXTENSIONS = 'js,jsx,ts,tsx,mjs,cjs';
const DEFAULT_ROUTER_DIR = 'src/pages';
const DEFAULT_ALIAS = '@';
const DEFAULT_ALIAS_DIR = 'src';

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isManualMainSrc(src) {
  const normalized = normalizePath(src).split('?')[0].split('#')[0].replace(/^\.\//, '');
  return /(^|\/)src\/main\.[^/]+$/i.test(normalized);
}

function hasAlias(config, find) {
  const alias = config?.resolve?.alias;
  if (!alias) return false;

  if (Array.isArray(alias)) {
    return alias.some((entry) => entry && entry.find === find);
  }

  return Object.prototype.hasOwnProperty.call(alias, find);
}

function createAliasConfig(config, options) {
  const aliasName = options.alias === undefined ? DEFAULT_ALIAS : options.alias;
  if (aliasName === false) return null;
  if (typeof aliasName !== 'string' || !aliasName) return null;
  if (hasAlias(config, aliasName)) return null;

  const aliasDir = options.aliasDir || DEFAULT_ALIAS_DIR;
  const rootDir = path.resolve(process.cwd(), config.root || '.');
  const replacement = path.resolve(rootDir, aliasDir);

  return {
    resolve: {
      alias: {
        [aliasName]: replacement,
      },
    },
  };
}

function hasManualModuleEntry(html) {
  const visit = (node) => {
    if (node.tagName === 'script') {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      const src = (attrs.src || '').split(/[?#]/)[0];
      if (attrs.type?.toLowerCase() === 'module' && (
        src === VIRTUAL_ENTRY_ID || src === PUBLIC_ENTRY_PATH || isManualMainSrc(src)
      )) return true;
    }
    return (node.childNodes || []).some(visit);
  };
  return visit(parse(String(html || '')));
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

      const routes = import.meta.glob("/${normalizedRouterDir}/**/*.{${ROUTE_GLOB_EXTENSIONS}}", { eager: true });
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
  // Bundler helpers are not application modules and may run before AEUI exists.
  if (id.startsWith('\0')) return false;
  const filePath = id.split('?')[0];
  if (!ROUTE_EXT_RE.test(filePath)) return false;
  if (filePath.includes('/node_modules/')) return false;
  return true;
}

function createParserPlugins(filePath) {
  if (/\.tsx?$/.test(filePath)) {
    return [
      ...(/\.tsx$/.test(filePath) ? ['jsx'] : []),
      ['typescript', {
        allExtensions: true,
        isTSX: /\.tsx$/.test(filePath),
      }],
    ];
  }

  return [];
}

export default function aeui(options = {}) {
  let root = process.cwd();

  return {
    name: 'aeui:vite',
    enforce: 'pre',

    config(config) {
      return createAliasConfig(config, options);
    },

    configResolved(config) {
      root = config.root;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (hasManualModuleEntry(html)) {
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
      const filePath = id.split('?')[0];

      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: filePath,
        parserOpts: {
          plugins: createParserPlugins(filePath),
        },
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
