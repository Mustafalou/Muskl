import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'appLanguage';

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguageCode = getLocales()[0]?.languageCode ?? '';
  return isSupportedLanguage(deviceLanguageCode) ? deviceLanguageCode : 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

// Applies a previously saved language choice, once, at app startup — overriding the
// device-locale-based default above if the user had explicitly picked something else.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
  if (stored && isSupportedLanguage(stored) && stored !== i18n.language) {
    i18n.changeLanguage(stored);
  }
});

export async function setAppLanguage(language: SupportedLanguage) {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export default i18n;
