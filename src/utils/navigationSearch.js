export const normalizeNavigationQuery = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function searchNavigationItems(items, query, labelFor) {
  const words = normalizeNavigationQuery(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => normalizeNavigationQuery(labelFor(item)).includes(word)));
}
