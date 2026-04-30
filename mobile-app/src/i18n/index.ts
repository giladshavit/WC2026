import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// Metro bundles JSON at build time. require() is the common RN pattern and avoids
// occasional ESM/json resolution quirks on Android with some Metro configs.
const en = require('./en.json');
const he = require('./he.json');

const languageTag = (getLocales()[0]?.languageTag ?? 'en').toLowerCase();
const lng = languageTag.startsWith('he') ? 'he' : 'en';

void Promise.resolve(
  i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    lng,
    fallbackLng: 'en',
    initImmediate: false,
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  } as any)
).catch((err) => {
  console.error('i18n init failed', err);
  if (err instanceof Error) {
    console.error('i18n init failed stack', err.stack);
  }
});

export default i18n;
