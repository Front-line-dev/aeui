import { compile } from './compile.js';

self.onmessage = ({ data: { id, source } }) => {
  try {
    self.postMessage({ id, code: compile(source) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
