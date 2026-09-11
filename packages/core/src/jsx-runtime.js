import { AEUI } from './core.js';

function createJsxVNode(tag, props, key, multipleChildren) {
  const { children, ...attributes } = props || {};
  // A key in a later spread takes precedence, including null and undefined.
  if (!Object.hasOwn(attributes, 'key') && key !== undefined) attributes.key = key;
  return multipleChildren && Array.isArray(children)
    ? AEUI.createElement(tag, attributes, ...children)
    : AEUI.createElement(tag, attributes, children);
}

export function jsx(tag, props, key) {
  return createJsxVNode(tag, props, key, false);
}

export function jsxs(tag, props, key) {
  return createJsxVNode(tag, props, key, true);
}

export const Fragment = AEUI.Fragment;
