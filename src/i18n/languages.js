export const languageStorageKey = "calciolab_language";

export const languages = [
  { code: "it", labelKey: "language.italian", shortLabel: "IT", flag: "🇮🇹" },
  { code: "en", labelKey: "language.english", shortLabel: "EN", flag: "🇬🇧" },
];

export function isSupportedLanguage(language) {
  return languages.some((item) => item.code === language);
}
