const accents = {
  home: { color: "#93bbff", soft: "rgba(96,165,250,0.13)" },
  team: { color: "#79d9e4", soft: "rgba(34,211,238,0.11)" },
  field: { color: "#86d9b4", soft: "rgba(52,211,153,0.11)" },
  match: { color: "#f2c47d", soft: "rgba(251,191,36,0.11)" },
  system: { color: "#b4c1d6", soft: "rgba(148,163,184,0.12)" },
  club: { color: "#c4a5f5", soft: "rgba(167,139,250,0.12)" },
};

export function navigationAccent(key = "") {
  const category = key.split(".").at(-1);
  const alias = { squadra: "team", campo: "field", gara: "match", analisi: "home", gestione: "system", juniors: "field" };
  return accents[alias[category] || category] || accents.home;
}

export function navigationItemIsActive(item, location) {
  const [path, query] = item.to.split("?");
  const matchesPath = location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  if (!matchesPath) return false;
  const current = new URLSearchParams(location.search);
  return [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
}
