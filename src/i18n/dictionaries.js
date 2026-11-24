export { it } from "./locales/it";

export async function loadEnglishDictionary() {
  const { en } = await import("./locales/en");
  return en;
}
