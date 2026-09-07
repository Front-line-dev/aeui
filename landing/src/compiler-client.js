let worker;
let sequence = 0;
const pending = new Map();

function stopWorker(message) {
  worker?.terminate();
  worker = undefined;
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.reject(new Error(message));
  }
  pending.clear();
}

export function compileInWorker(source) {
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
    worker.onerror = () => stopWorker('컴파일러를 불러오지 못했습니다. 다시 실행해 주세요.');
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => stopWorker('컴파일 시간이 초과되었습니다. 코드를 줄이고 다시 실행해 주세요.'), 15000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, source });
  });
}
