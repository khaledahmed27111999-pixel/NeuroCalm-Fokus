import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, Direction, LocaleContextType, TranslationKey } from '../types/locale';
import { en } from '../locales/en';
import { ar } from '../locales/ar';

const STORAGE_KEY = 'neurocalm_locale';

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en,
  ar,
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'en' || saved === 'ar') {
        return saved;
      }
      return navigator.language.startsWith('ar') ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });

  const direction: Direction = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Graceful fallback for environments with blocked storage
    }
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', locale);
  }, [locale, direction]);

  const toggleLocale = () => {
    setLocaleState((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const activeDict = translations[locale];
    let text = (activeDict && activeDict[key]) || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    return text;
  };

  return (
    <LocaleContext.Provider value={{ locale, direction, toggleLocale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
