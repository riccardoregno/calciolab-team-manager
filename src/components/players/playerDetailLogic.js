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

// Schede di prevenzione generale: visibili a TUTTI i giocatori indipendentemente dagli infortuni
export const PREVENTION_BASE = [
  {
    key: "nordic",
    title: "Lesione muscolare coscia",
    reason: "PREVENZIONE",
    points: [
      "Nordic Hamstring 2x/settimana",
      "Monitoraggio spike di carico settimanale",
      "Rientro sprint progressivo prima del gruppo pieno",
    ],
  },
  {
    key: "distorsione_caviglia",
    title: "Distorsione caviglia",
    reason: "PREVENZIONE",
    points: [
      "Propriocezione monopodalica e superfici instabili",
      "Rinforzo peronei con elastici",
      "Progressione da statico a cambi direzione",
    ],
  },
  {
    key: "pubalgia_base",
    title: "Pubalgia / adduttori",
    reason: "PREVENZIONE",
    points: [
      "Copenhagen Adduction e core stability",
      "Riduzione cambi direzione ad alta densità",
      "Monitoraggio dolore inguinale post-seduta",
    ],
  },
  {
    key: "recidiva",
    title: "Recidiva muscolare",
    reason: "RETURN TO PLAY",
    points: [
      "Progressione 50% → 75% → 100% intensità",
      "Test funzionali senza dolore prima del contatto",
      "Controllo carico individuale per 2 settimane",
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
