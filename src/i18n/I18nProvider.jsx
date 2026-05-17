import { useCallback, useEffect, useMemo, useState } from "react";

import { dictionaries } from "./dictionaries";
import { I18nContext } from "./I18nContext";
import { isSupportedLanguage, languageStorageKey } from "./languages";

function getInitialLanguage() {
  if (typeof window === "undefined") return "it";

  const stored = window.localStorage.getItem(languageStorageKey);
  if (isSupportedLanguage(stored)) return stored;

  const browserLanguage = window.navigator.language?.slice(0, 2);
  return isSupportedLanguage(browserLanguage) ? browserLanguage : "it";
}

function getValue(source, key) {
  return key.split(".").reduce((value, part) => value?.[part], source);
}

function interpolate(template, params = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (
    params[key] === undefined || params[key] === null ? "" : String(params[key])
  ));
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!isSupportedLanguage(nextLanguage)) return;
    setLanguageState(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(languageStorageKey, nextLanguage);
      document.documentElement.lang = nextLanguage;
    }
  }, []);

  const t = useCallback((key, params) => {
    const dictionary = dictionaries[language] || dictionaries.it;
    const fallback = dictionaries.it;
    const value = getValue(dictionary, key) ?? getValue(fallback, key);

    if (typeof value !== "string") return key;
    return interpolate(value, params);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
