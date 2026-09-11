export type PrimitiveRenderable = string | number | bigint;

export type Renderable =
  | VNode<any>
  | PrimitiveRenderable
  | boolean
  | null
  | undefined
  | Renderable[];

export type RenderFunction<P = Record<string, unknown>> = (props?: P) => Renderable;

export type Component<P = Record<string, unknown>> = (
  props: P
) => Renderable | RenderFunction<P>;

export type FragmentComponent = (
  initialProps?: { children?: Renderable[] }
) => RenderFunction<{ children?: Renderable[] }>;

export type VNodeTag<P = Record<string, unknown>> = string | Component<P> | FragmentComponent;

export interface VNode<P = Record<string, unknown>> {
  tag: VNodeTag<any>;
  props: (P & { children?: Renderable[] }) | null;
  children: Renderable[];
}

export interface AeuiRuntimeInternals {
  watch(callback: () => void, deps?: readonly unknown[] | (() => readonly unknown[])): void;
  clean(callback: () => void): void;
  runRenderPhase(...args: unknown[]): Renderable;
  [key: string]: unknown;
}

export interface AeuiApp {
  createVNode<P = Record<string, unknown>>(
    tag: VNodeTag<P>,
    props?: P | null,
    ...children: Renderable[]
  ): VNode<P>;
  createElement<P = Record<string, unknown>>(
    tag: VNodeTag<P>,
    props?: P | null,
    ...children: Renderable[]
  ): VNode<P>;
  Fragment: FragmentComponent;
  init(rootComponent: Component<any>, containerElement: Element): void;
  render(): boolean;
  __runtime: AeuiRuntimeInternals;
}

export declare const AEUI: AeuiApp;

export declare function createElement<P = Record<string, unknown>>(
  tag: VNodeTag<P>,
  props?: P | null,
  ...children: Renderable[]
): VNode<P>;

export declare function watch(
  callback: () => void,
  deps?: readonly unknown[] | (() => readonly unknown[])
): void;

export declare function clean(callback: () => void): void;

declare global {
  namespace JSX {
    interface Element extends VNode {}
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      [elementName: string]: Record<string, unknown>;
    }
  }
}

export declare namespace AEUI {
  namespace JSX {
    interface Element extends VNode {}
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      [elementName: string]: Record<string, unknown>;
    }
  }
}
