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
  {
    key: "ginocchio",
    title: "Ginocchio (LCA / patella)",
    reason: "PREVENZIONE",
    points: [
      "Squat monopodalico e step-up eccentrico",
      "Rinforzo quadricipite e ischio-crurali progressivo",
      "Controllo del valgo dinamico nei salti e cambi direzione",
    ],
  },
  {
    key: "tendine",
    title: "Tendinopatia (Achillea / rotulea)",
    reason: "PREVENZIONE",
    points: [
      "Heel drop eccentrico su superficie inclinata 2x/settimana",
      "Evitare picchi di carico improvvisi (spike >10%/settimana)",
      "Monitoraggio rigidità mattutina e dolore post-seduta",
    ],
  },
  {
    key: "lombalgia",
    title: "Lombalgia e colonna",
    reason: "PREVENZIONE",
    points: [
      "Core stability: plank, bird-dog, dead bug progressivi",
      "Mobilità toracica e flessibilità catena posteriore",
      "Evitare sessioni ad alto volume di sprint in stanchezza",
    ],
  },
  {
    key: "mezieres",
    title: "Posture Mézières",
    reason: "POSTURA",
    points: [
      "Correzione catena muscolare posteriore: riduce lombalgia, tensioni cervicali e retroversione del bacino tipiche del calciatore",
      "Allungamento globale in postura antalgica: migliora la qualità del gesto atletico e previene squilibri muscolari da sovraccarico",
      "Lavoro diaframmatico e respiratorio: favorisce il recupero, abbassa il tono muscolare di fondo e migliora la mobilità toracica",
      "Riequilibrio posturale a lungo termine: riduce il rischio di infortuni ricorrenti legati a compensazioni posturali croniche",
    ],
  },
  {
    key: "propriocezione_avanzata",
    title: "Propriocezione caviglia (meduse ed elastici)",
    reason: "PREVENZIONE",
    points: [
      "Medusa / tavoletta instabile monopodalica: 3×30 sec per lato, occhi aperti poi chiusi — allena i recettori articolari che prevengono le distorsioni",
      "Elastico peronei laterali: 3×15 ripetizioni di eversione resistita — rinforza i muscoli stabilizzatori esterni della caviglia",
      "Elastico tibiale anteriore: 3×15 di flessione dorsale contro resistenza — migliora il controllo in frenata e cambio direzione",
      "Saltelli monopodalici su superficie instabile: progressione che trasferisce la stabilità acquisita al gesto sportivo reale",
    ],
  },
  {
    key: "elastici_anca",
    title: "Elastici — anca e catena cinetica",
    reason: "PREVENZIONE",
    points: [
      "Abduzione anca con elastico (clamshell, monster walk): attiva il medio gluteo, riduce il rischio di pubalgia e dolore al ginocchio",
      "Estensione dell'anca in piedi con elastico: rinforza i glutei e scarica il quadricipite — essenziale dopo infortuni al ginocchio",
      "Hip thrust con banda elastica: potenza dei flessori e stabilizzatori del bacino per sprint e frenate",
      "Rotazione esterna resistita: protegge l'LCA migliorando il controllo del valgo dinamico",
    ],
  },
  {
    key: "flessori_anca",
    title: "Flessori dell'anca e mobilità",
    reason: "PREVENZIONE",
    points: [
      "Stretching psoas-iliaco in affondo (2×60 sec per lato): i calciatori accorciano cronicamente i flessori — causa diretta di lombalgia e pubalgia",
      "Rinforzo eccentrico del retto femorale: previene le lesioni al quadricipite, frequenti nei tiri e negli sprint",
      "Mobilità dell'articolazione dell'anca in rotazione interna/esterna: migliora la fluidità del passo e riduce le compensazioni alla schiena",
      "Esercizi di dissociazione lombo-pelvica: insegna a muovere il bacino indipendentemente dalla colonna",
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
