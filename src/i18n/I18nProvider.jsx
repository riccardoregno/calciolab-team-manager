import { useCallback, useEffect, useMemo, useState } from "react";

import { it, loadEnglishDictionary } from "./dictionaries";
import { I18nContext } from "./I18nContext";
import { isSupportedLanguage, languageStorageKey } from "./languages";

function getInitialLanguage() {
  if (typeof window === "undefined") return "it";

  try {
    const stored = window.localStorage.getItem(languageStorageKey);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // The browser language is still available when storage is blocked.
  }

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
  const [locale, setLocale] = useState(() => {
    const request = getInitialLanguage() === "en" ? { remember: false } : null;
    return { language: "it", dictionary: it, request, loadFailed: false };
  });
  const { language, dictionary, request, loadFailed } = locale;

  useEffect(() => {
    if (!request) return;
    let active = true;
    loadEnglishDictionary().then((en) => {
      if (!active) return;
      if (request.remember) rememberLanguage("en");
      setLocale({ language: "en", dictionary: en, request: null, loadFailed: false });
    }, () => {
      if (active) setLocale({ language: "it", dictionary: it, request: null, loadFailed: true });
    });
    return () => { active = false; };
  }, [request]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!isSupportedLanguage(nextLanguage) || nextLanguage === language || request) return;
    if (nextLanguage === "it") {
      rememberLanguage("it");
      setLocale({ language: "it", dictionary: it, request: null, loadFailed: false });
    } else {
      setLocale({ language: "it", dictionary: it, request: { remember: true }, loadFailed: false });
    }
  }, [language, request]);

  const t = useCallback((key, params) => {
    const value = getValue(dictionary, key) ?? getValue(it, key);

    if (typeof value !== "string") return key;
    return interpolate(value, params);
  }, [dictionary]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    languageLoading: Boolean(request),
    languageLoadFailed: loadFailed,
    t,
  }), [language, setLanguage, request, loadFailed, t]);

  if (request && !request.remember) {
    return <p lang="en" role="status">Loading CalcioLab…</p>;
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

function rememberLanguage(language) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch {
    // The active language still changes for this session.
  }
}
