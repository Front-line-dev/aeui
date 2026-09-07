import './styles.css';
import { getExamples } from './examples.js';
import { applyLocale, getMessages, resolveLocale } from './i18n.js';

const locale = resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
applyLocale(document, locale);
const examples = getExamples(locale);

const disposers = [];
let playgroundModule;
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    playgroundModule ??= import('./playground.js');
    playgroundModule.then(({ mountPlayground }) => {
      disposers.push(mountPlayground(entry.target, examples[entry.target.dataset.example], locale));
    }).catch(() => {
      entry.target.textContent = getMessages(locale).ui.loadError;
    });
  }
}, { rootMargin: '400px' });
document.querySelectorAll('[data-example]').forEach(element => observer.observe(element));
if (import.meta.hot) import.meta.hot.dispose(() => {
  observer.disconnect();
  disposers.forEach(dispose => dispose());
});
