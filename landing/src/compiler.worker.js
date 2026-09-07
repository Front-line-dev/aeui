import { compile } from './compile.js';

self.onmessage = ({ data: { id, source, locale } }) => {
  try {
    self.postMessage({ id, code: compile(source, locale) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
