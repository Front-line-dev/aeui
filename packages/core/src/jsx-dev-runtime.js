import { jsx, jsxs } from './jsx-runtime.js';

export { Fragment } from './jsx-runtime.js';

// Source/self metadata belongs to the compiler and is not forwarded to DOM props.
export function jsxDEV(tag, props, key, isStaticChildren) {
  return (isStaticChildren ? jsxs : jsx)(tag, props, key);
}
