import { locales } from './locales.js';

export function resolveLocale(languages = []) {
  for (const language of languages) {
    if (typeof language !== 'string') continue;
    const base = language.toLowerCase().split('-')[0];
    if (Object.hasOwn(locales, base)) return base;
  }
  return 'en';
}

export const languageTag = locale => locale === 'zh' ? 'zh-Hans' : resolveLocale([locale]);
export const getMessages = locale => locales[resolveLocale([locale])];

export function applyLocale(document, locale) {
  const messages = getMessages(locale);
  document.documentElement.lang = languageTag(locale);
  document.title = messages.title;
  document.querySelector('meta[name="description"]').content = messages.description;
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.innerHTML = messages[element.dataset.i18n];
  }
  for (const element of document.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', messages[element.dataset.i18nAria]);
  }
}
