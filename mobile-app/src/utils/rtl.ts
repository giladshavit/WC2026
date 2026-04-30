import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';

// Primary source: I18nManager (reflects forceRTL from App.tsx)
// Fallback: device locale (for first render before forceRTL applies)
const localeIsHebrew = (getLocales()[0]?.languageTag ?? 'en')
  .toLowerCase()
  .startsWith('he');

export const IS_RTL: boolean = I18nManager.isRTL || localeIsHebrew;
