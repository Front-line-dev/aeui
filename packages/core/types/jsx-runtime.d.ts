import type { AEUI, FragmentComponent, Renderable, VNode, VNodeTag } from './index.js';

// JSX receives raw children; the runtime normalizes them before component setup.
export type JSXProps<P> = Omit<P, 'children' | 'key'> & { children?: Renderable; key?: unknown };

export declare function jsx<P = Record<string, unknown>>(
  tag: VNodeTag<P>,
  props: JSXProps<P> | null,
  key?: unknown
): VNode<P>;

export declare const jsxs: typeof jsx;
export declare const Fragment: (props?: { children?: Renderable }) => ReturnType<FragmentComponent>;

export namespace JSX {
  type ElementType = VNodeTag<any>;
  interface Element extends AEUI.JSX.Element {}
  interface ElementAttributesProperty extends AEUI.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends AEUI.JSX.ElementChildrenAttribute {}
  interface IntrinsicElements extends AEUI.JSX.IntrinsicElements {}
  interface IntrinsicAttributes { key?: unknown; }
}
