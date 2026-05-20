const PREVENTION_LIBRARY = [
  {
    key: "muscolare",
    title: "Recidiva muscolare",
    match: ["muscolare", "coscia", "hamstring", "quadricipite", "flessore", "adduttore"],
    points: [
      "Progressione sprint 50% - 75% - 100% prima del rientro pieno",
      "Forza eccentrica 2 volte a settimana",
      "Monitoraggio dolore e rigidita nelle 24 ore post seduta",
    ],
  },
  {
    key: "caviglia",
    title: "Caviglia e controllo articolare",
    match: ["caviglia", "distorsione", "articolare", "legamentoso"],
    points: [
      "Propriocezione monopodalica e superfici instabili",
      "Rinforzo peronei con elastici",
      "Progressione cambi direzione prima del contatto",
    ],
  },
  {
    key: "pubalgia",
    title: "Adduttori e pubalgia",
    match: ["pubalgia", "adduttore", "inguine", "adduttori"],
    points: [
      "Copenhagen Adduction a carico progressivo",
      "Core stability anti-rotazione",
      "Riduzione temporanea dei cambi direzione ad alta densita",
    ],
  },
  {
    key: "carico",
    title: "Gestione carico e affaticamento",
    match: ["affaticamento", "sovraccarico", "fatica", "recupero"],
    points: [
      "Settimana con volume ridotto e intensita controllata",
      "RPE individuale dopo ogni seduta",
      "Rientro graduale nel lavoro metabolico",
    ],
  },
];

export function getPreventionRecommendations(injuryHistory, player) {
  const source = [
    player?.injuryType,
    player?.differentiatedType,
    player?.injuryNotes,
    ...injuryHistory.flatMap((injury) => [
      injury.injuryType,
      injury.differentiatedType,
      injury.notes,
    ]),
  ].filter(Boolean).join(" ").toLowerCase();

  const suggested = PREVENTION_LIBRARY
    .filter((item) => item.match.some((term) => source.includes(term)))
    .map((item) => ({
      ...item,
      reason: item.key === "carico" ? "Carico" : "Storico",
    }));

  if (suggested.length) return suggested;
  if ((player?.status || "") === "Differenziato") {
    return [{
      ...PREVENTION_LIBRARY.find((item) => item.key === "carico"),
      reason: "Differenziato",
    }];
  }

  return [];
}
