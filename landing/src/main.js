import './styles.css';
import { examples } from './examples.js';

const disposers = [];
let playgroundModule;
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    playgroundModule ??= import('./playground.js');
    playgroundModule.then(({ mountPlayground }) => {
      disposers.push(mountPlayground(entry.target, examples[entry.target.dataset.example]));
    }).catch(() => {
      entry.target.textContent = '예제를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    });
  }
}, { rootMargin: '400px' });
document.querySelectorAll('[data-example]').forEach(element => observer.observe(element));
if (import.meta.hot) import.meta.hot.dispose(() => {
  observer.disconnect();
  disposers.forEach(dispose => dispose());
});
