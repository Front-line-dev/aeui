import type { VNode, VNodeTag } from './index.js';
import type { JSXProps } from './jsx-runtime.js';

export { Fragment, JSX } from './jsx-runtime.js';

export declare function jsxDEV<P = Record<string, unknown>>(
  tag: VNodeTag<P>,
  props: JSXProps<P> | null,
  key?: unknown,
  isStaticChildren?: boolean,
  source?: { fileName?: string; lineNumber?: number; columnNumber?: number },
  self?: unknown
): VNode<P>;
