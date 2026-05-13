import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { styles } from "../../styles/index.js";

export default function Topbar({
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
}) {
  const [search, setSearch] = useState("");
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const playerResults = players
      .filter((p) =>
        `${p.name} ${p.role} ${p.status}`.toLowerCase().includes(q)
      )
      .map((p) => ({
        id: `player-${p.id}`,
        label: p.name,
        meta: `Giocatore · ${p.role || "Ruolo non definito"}`,
        to: `/players/${p.id}`,
      }));

    const exerciseResults = exercises
      .filter((e) =>
        `${e.title} ${e.category} ${e.objective}`.toLowerCase().includes(q)
      )
      .map((e) => ({
        id: `exercise-${e.id}`,
        label: e.title,
        meta: `Esercizio · ${e.category || "Categoria"}`,
        to: "/exercises",
      }));

    const sessionResults = sessions
      .filter((s) =>
        `${s.title} ${s.date} ${s.objective}`.toLowerCase().includes(q)
      )
      .map((s) => ({
        id: `session-${s.id}`,
        label: s.title || "Seduta",
        meta: `Allenamento · ${s.date || "Data non definita"}`,
        to: "/trainings",
      }));

    const matchResults = matches
      .filter((m) =>
        `${m.opponent} ${m.date} ${m.competition} ${m.location}`
          .toLowerCase()
          .includes(q)
      )
      .map((m) => ({
        id: `match-${m.id}`,
        label: m.opponent || "Partita",
        meta: `Match · ${m.date || "Data non definita"}`,
        to: "/matches",
      }));

    return [
      ...playerResults,
      ...exerciseResults,
      ...sessionResults,
      ...matchResults,
    ].slice(0, 8);
  }, [search, players, exercises, sessions, matches]);

  const notifications = useMemo(() => {
    const today = new Date();

    const upcomingSessions = sessions
      .filter((s) => s.date && new Date(s.date) >= today)
      .slice(0, 2)
      .map((s) => ({
        id: `session-note-${s.id}`,
        title: s.title || "Seduta in programma",
        text: s.date || "Data non definita",
        to: "/trainings",
      }));

    const upcomingMatches = matches
      .filter((m) => m.date && new Date(m.date) >= today)
      .slice(0, 2)
      .map((m) => ({
        id: `match-note-${m.id}`,
        title: `Match vs ${m.opponent || "avversario"}`,
        text: m.date || "Data non definita",
        to: "/matches",
      }));

    const injuredPlayers = players
      .filter((p) => p.status === "Infortunato")
      .slice(0, 2)
      .map((p) => ({
        id: `injury-note-${p.id}`,
        title: `${p.name} infortunato`,
        text: p.injury || "Controllare stato fisico",
        to: `/players/${p.id}`,
      }));

    return [...upcomingSessions, ...upcomingMatches, ...injuredPlayers].slice(
      0,
      5
    );
  }, [sessions, matches, players]);

  return (
    <header style={styles.topbar}>
      <div style={styles.topbarLeft}>
        <p style={styles.topbarEyebrow}>Benvenuto, Coach</p>
        <h1 style={styles.topbarTitle}>Gestisci la tua stagione</h1>
      </div>

      <div style={styles.topbarActions}>
        <div style={styles.topbarSearchWrapper}>
          <div style={styles.topbarSearchBox}>
            <span style={styles.topbarSearchIcon}>⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca giocatori, sedute, esercizi..."
              style={styles.topbarSearchInput}
            />
          </div>

          {search && (
            <div style={styles.topbarSearchResults}>
              {results.length > 0 ? (
                results.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={styles.topbarSearchResult}
                    onClick={() => setSearch("")}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.meta}</span>
                  </Link>
                ))
              ) : (
                <div style={styles.topbarSearchEmpty}>
                  Nessun risultato trovato
                </div>
              )}
            </div>
          )}
        </div>

        <Link to="/trainings" style={styles.topbarPrimaryAction}>
          <span style={styles.topbarPlus}>+</span>
          Nuova seduta
        </Link>

        <div style={{ position: "relative" }}>
          <button
            style={styles.topbarIconButton}
            title="Notifiche"
            onClick={() => setOpenNotifications(!openNotifications)}
          >
            🔔
            {notifications.length > 0 && (
              <span style={styles.topbarNotificationDot} />
            )}
          </button>

          {openNotifications && (
            <div style={styles.topbarNotificationsPanel}>
              <div style={styles.topbarNotificationsHeader}>
                <strong>Centro attività</strong>
                <span>{notifications.length}</span>
              </div>

              {notifications.length > 0 ? (
                notifications.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    style={styles.topbarNotificationItem}
                    onClick={() => setOpenNotifications(false)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </Link>
                ))
              ) : (
                <div style={styles.topbarNotificationEmpty}>
                  Nessuna attività urgente
                </div>
              )}
            </div>
          )}
        </div>

       <div style={{ position: "relative" }}>
  <button
    style={styles.topbarProfileButton}
    onClick={() => setOpenProfile(!openProfile)}
  >
    <div style={styles.topbarAvatar}>C</div>

    <div style={styles.topbarProfileText}>
      <strong style={styles.topbarProfileName}>Coach</strong>
      <span style={styles.topbarProfileRole}>Locale MVP</span>
    </div>

    <span style={styles.topbarChevron}>⌄</span>
  </button>

  {openProfile && (
  <div style={styles.topbarProfileMenu}>
    <div style={styles.topbarProfileMenuHeader}>
      <strong>Profilo Coach</strong>
      <span>CalcioLab Team</span>
    </div>

    <Link
      to="/settings"
      style={styles.topbarProfileMenuItem}
      onClick={() => setOpenProfile(false)}
    >
      ⚙️ Impostazioni
    </Link>

    <Link
      to="/statistics"
      style={styles.topbarProfileMenuItem}
      onClick={() => setOpenProfile(false)}
    >
      📊 Dashboard performance
    </Link>

      <Link
        to="/players"
        style={styles.topbarProfileMenuItem}
        onClick={() => setOpenProfile(false)}
      >
        👥 Gestione rosa
      </Link>

      <Link
        to="/trainings"
        style={styles.topbarProfileMenuItem}
        onClick={() => setOpenProfile(false)}
      >
        🗓️ Pianificazione
      </Link>

      <button style={styles.topbarProfileLogout}>
        Esci dalla demo
      </button>
    </div>
  )}
</div>

      </div>
    </header>
  );
}