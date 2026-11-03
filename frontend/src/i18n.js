/* ==========================================================================
   Languages: Russian (default) and English, with react-i18next.
   The choice is kept in localStorage and mirrored in <html lang>.
   ========================================================================== */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';

const STORAGE_KEY = 'bloom.lang';
export const LANGUAGES = ['ru', 'en'];

function savedLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.includes(value) ? value : 'ru';
  } catch {
    return 'ru';
  }
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* private mode: not remembered */ }
});

i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: savedLanguage(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },   // React escapes already
  returnEmptyString: true,
});

/** 'ru-RU' / 'en-US' for Intl date formatting */
export function locale() {
  return i18n.language === 'en' ? 'en-US' : 'ru-RU';
}

/**
 * Messages from Django/DRF are always Russian. In English, translate the common
 * ones; anything unknown is shown as it came.
 */
export function serverMessage(message) {
  if (i18n.language === 'ru' || typeof message !== 'string') return message;
  const known = i18n.t('serverErrors', { returnObjects: true });
  if (known[message]) return known[message];
  for (const [pattern, replacement] of i18n.t('serverErrorPatterns', { returnObjects: true })) {
    const re = new RegExp(pattern);
    if (re.test(message)) return message.replace(re, replacement);
  }
  return message;
}

export default i18n;
