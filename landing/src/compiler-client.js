import { getMessages } from './i18n.js';

let worker;
let sequence = 0;
const pending = new Map();

function stopWorker(messageKey) {
  worker?.terminate();
  worker = undefined;
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(new Error(getMessages(task.locale).ui[messageKey]));
  }
  pending.clear();
}

export function compileInWorker(source, locale = 'en') {
  if (!worker) {
    worker = new Worker(new URL('./compiler.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const task = pending.get(data.id);
      if (!task) return;
      clearTimeout(task.timer);
      pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.code);
    };
    worker.onerror = () => stopWorker('compilerError');
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => stopWorker('compilerTimeout'), 15000);
    pending.set(id, { resolve, reject, timer, locale });
    worker.postMessage({ id, source, locale });
  });
}
