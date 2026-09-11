import { AEUI } from './core.js';

// Automatic JSX falls back to createElement when key follows a spread.
export function createElement(tag, props, ...children) {
  return children.length === 0
    ? AEUI.createElement(tag, props, props?.children)
    : AEUI.createElement(tag, props, ...children);
}
