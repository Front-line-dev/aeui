const ROUTE_EXT_RE = /\.[cm]?[jt]sx?$/;
const DEFAULT_ROOT_DIR = '/src/pages';
const ROUTE_ROOT_MARKERS = ['/pages/'];

function stripQuery(path) {
  return String(path || '').split('?')[0].split('#')[0];
}

function normalizeSlashes(path) {
  return String(path || '').replace(/\\/g, '/');
}

function trimTrailingSlash(path) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function normalizeRootDir(rootDir) {
  const normalized = normalizeSlashes(rootDir || DEFAULT_ROOT_DIR).replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function inferRootDir(routeModules, rootDir) {
  if (rootDir) return normalizeRootDir(rootDir);

  const paths = Object.keys(routeModules || {}).map((filePath) => stripQuery(normalizeSlashes(filePath)));
  if (paths.some((filePath) => filePath.startsWith(`${DEFAULT_ROOT_DIR}/`))) return DEFAULT_ROOT_DIR;

  return DEFAULT_ROOT_DIR;
}

function toRouteRelativePath(filePath, rootDir) {
  const normalizedPath = stripQuery(normalizeSlashes(filePath));
  const normalizedRoot = normalizeRootDir(rootDir);

  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  for (const marker of ROUTE_ROOT_MARKERS) {
    const markerIndex = normalizedPath.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return normalizedPath.slice(markerIndex + marker.length);
    }
  }

  return normalizedPath.replace(/^\.?\//, '');
}

function parseQuery(searchParams) {
  const query = {};

  searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key];
      query[key] = Array.isArray(current) ? [...current, value] : [current, value];
      return;
    }

    query[key] = value;
  });

  return query;
}

function parseSegment(segment) {
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) {
    return { kind: 'catchAll', name: catchAll[1], raw: segment };
  }

  const dynamic = segment.match(/^\[([^\]]+)\]$/);
  if (dynamic) {
    return { kind: 'dynamic', name: dynamic[1], raw: segment };
  }

  return { kind: 'static', value: segment, raw: segment };
}

function segmentRank(segment) {
  if (segment.kind === 'static') return 30;
  if (segment.kind === 'dynamic') return 20;
  return 0;
}

function compareRoutes(a, b) {
  const max = Math.max(a.segments.length, b.segments.length);

  for (let i = 0; i < max; i += 1) {
    const aSegment = a.segments[i];
    const bSegment = b.segments[i];

    if (!aSegment) return 1;
    if (!bSegment) return -1;

    const rankDelta = segmentRank(bSegment) - segmentRank(aSegment);
    if (rankDelta) return rankDelta;
  }

  return b.segments.length - a.segments.length;
}

function routePathFromSegments(segments) {
  if (!segments.length) return '/';

  const parts = segments.map((segment) => {
    if (segment.kind === 'static') return segment.value;
    if (segment.kind === 'dynamic') return `:${segment.name}`;
    return `*${segment.name}`;
  });

  return `/${parts.join('/')}`;
}

function createRoute(filePath, mod, rootDir) {
  const relativePath = toRouteRelativePath(filePath, rootDir);
  if (!ROUTE_EXT_RE.test(relativePath)) return null;

  const withoutExt = relativePath.replace(ROUTE_EXT_RE, '');
  const parts = withoutExt.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';

  if (fileName.startsWith('_')) return null;
  if (fileName === '404') return null;

  const routeParts = parts.slice();
  if (routeParts[routeParts.length - 1] === 'index') {
    routeParts.pop();
  }

  const segments = routeParts.map(parseSegment);
  if (segments.some((segment, index) => segment.kind === 'catchAll' && index !== segments.length - 1)) {
    return null;
  }

  const component = mod && (mod.default || mod.Page || mod);
  if (typeof component !== 'function') return null;

  return {
    component,
    filePath,
    path: routePathFromSegments(segments),
    segments,
  };
}

function findSpecialModule(routeModules, rootDir, name) {
  for (const [filePath, mod] of Object.entries(routeModules || {})) {
    const relativePath = toRouteRelativePath(filePath, rootDir);
    if (!ROUTE_EXT_RE.test(relativePath)) continue;

    const withoutExt = relativePath.replace(ROUTE_EXT_RE, '');
    if (withoutExt === name) {
      const component = mod && (mod.default || mod.Page || mod);
      return typeof component === 'function' ? component : null;
    }
  }

  return null;
}

export function createRouteTable(routeModules, options = {}) {
  const rootDir = inferRootDir(routeModules, options.rootDir);
  const routes = Object.entries(routeModules || {})
    .map(([filePath, mod]) => createRoute(filePath, mod, rootDir))
    .filter(Boolean)
    .sort(compareRoutes);

  return {
    fallback: findSpecialModule(routeModules, rootDir, '404'),
    layout: findSpecialModule(routeModules, rootDir, '_layout'),
    routes,
  };
}

function resolveHref(href) {
  const fallbackOrigin = 'http://aeui.local';
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : fallbackOrigin;
  return new URL(href || '/', origin);
}

function routeInfoFromUrl(url, params = {}) {
  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    params,
    pathname: trimTrailingSlash(url.pathname || '/'),
    query: parseQuery(url.searchParams),
  };
}

function safeDecodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function matchSegments(routeSegments, pathSegments) {
  const params = {};

  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.kind === 'catchAll') {
      const rest = pathSegments.slice(i);
      if (rest.length === 0) return null;

      const decoded = rest.map(safeDecodeSegment);
      if (decoded.some((segment) => segment == null)) return null;

      params[routeSegment.name] = decoded;
      return params;
    }

    if (pathSegment == null) return null;

    if (routeSegment.kind === 'static') {
      const decoded = safeDecodeSegment(pathSegment);
      if (decoded == null || routeSegment.value !== decoded) {
        return null;
      }
    }

    if (routeSegment.kind === 'dynamic') {
      const decoded = safeDecodeSegment(pathSegment);
      if (decoded == null) return null;
      params[routeSegment.name] = decoded;
    }
  }

  return routeSegments.length === pathSegments.length ? params : null;
}

export function matchRoute(routeTable, href) {
  const url = resolveHref(href);
  const pathname = trimTrailingSlash(url.pathname || '/');
  const pathSegments = pathname.split('/').filter(Boolean);

  for (const route of routeTable.routes || []) {
    const params = matchSegments(route.segments, pathSegments);
    if (!params) continue;

    return {
      component: route.component,
      filePath: route.filePath,
      isFallback: false,
      path: route.path,
      route: routeInfoFromUrl(url, params),
    };
  }

  return {
    component: routeTable.fallback || null,
    filePath: null,
    isFallback: true,
    path: '404',
    route: routeInfoFromUrl(url, {}),
  };
}

function DefaultNotFound({ route }) {
  return () => ({
    tag: 'main',
    props: {
      children: [
        {
          tag: 'h1',
          props: { children: ['404'] },
          children: ['404'],
        },
        {
          tag: 'p',
          props: { children: [`Page not found: ${route.pathname}`] },
          children: [`Page not found: ${route.pathname}`],
        },
      ],
    },
    children: [
      {
        tag: 'h1',
        props: { children: ['404'] },
        children: ['404'],
      },
      {
        tag: 'p',
        props: { children: [`Page not found: ${route.pathname}`] },
        children: [`Page not found: ${route.pathname}`],
      },
    ],
  });
}

function currentHref() {
  if (typeof window === 'undefined' || !window.location) return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function findAnchor(target, container) {
  if (!target || typeof target.closest !== 'function') return null;
  const anchor = target.closest('a[href]');
  if (!anchor || !container.contains(anchor)) return null;
  return anchor;
}

export function shouldHandleAnchorClick(event, anchor) {
  if (!event || !anchor) return false;
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return false;
  if (anchor.hasAttribute('download')) return false;

  const target = String(anchor.getAttribute('target') || '').toLowerCase();
  if (target && target !== '_self') return false;

  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return false;

  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  return true;
}

function pushRouterHistory(url) {
  const nextHref = `${url.pathname}${url.search}${url.hash}`;
  const current = currentHref();
  if (nextHref === current) return false;

  window.history.pushState({}, '', nextHref);
  return true;
}

export function createDirectoryRouter(state, routeModules, options = {}) {
  const routeTable = createRouteTable(routeModules, options);
  const router = {
    current: matchRoute(routeTable, currentHref()),
    routeTable,
  };

  function syncFromLocation() {
    router.current = matchRoute(routeTable, currentHref());
  }

  function Root() {
    return () => {
      const match = router.current || matchRoute(routeTable, currentHref());
      const Page = match.component || DefaultNotFound;
      const pageVNode = state.createVNode(Page, { route: match.route });

      if (typeof routeTable.layout === 'function') {
        return state.createVNode(routeTable.layout, { route: match.route }, pageVNode);
      }

      return pageVNode;
    };
  }

  function attach(container) {
    if (!container || typeof window === 'undefined') return;

    const onPopState = () => {
      syncFromLocation();
      state.requestRender();
    };

    const onClick = (event) => {
      const anchor = findAnchor(event.target, container);
      if (!shouldHandleAnchorClick(event, anchor)) return;

      event.preventDefault();
      const changed = pushRouterHistory(new URL(anchor.href));
      if (!changed) return;

      syncFromLocation();
      state.requestRender();
    };

    window.addEventListener('popstate', onPopState);
    container.addEventListener('click', onClick);

    state.routerTeardown = () => {
      window.removeEventListener('popstate', onPopState);
      container.removeEventListener('click', onClick);
      if (state.routerTeardown) {
        state.routerTeardown = null;
      }
    };
  }

  return { Root, attach, router };
}
