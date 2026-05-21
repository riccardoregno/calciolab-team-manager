import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { formatDate, normalizeAppSettings } from "../utils/helpers";
import { useTranslation } from "../i18n";

const MAX_PLAYERS = 22;

const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
const ROLE_LABEL = {
  Portiere:       { short: "POR", tone: "orange" },
  Difensore:      { short: "DIF", tone: "blue" },
  Centrocampista: { short: "CEN", tone: "green" },
  Attaccante:     { short: "ATT", tone: "red" },
};

function groupByRole(players) {
  const groups = {};
  players.forEach((p) => {
    const role = ROLE_ORDER.includes(p.role) ? p.role : "Altro";
    if (!groups[role]) groups[role] = [];
    groups[role].push(p);
  });
  // ordina i gruppi per ruolo
  const ordered = {};
  [...ROLE_ORDER, "Altro"].forEach((r) => {
    if (groups[r]?.length) ordered[r] = groups[r];
  });
  return ordered;
}

function getHomeVenue(profile = {}) {
  return [profile.homeFieldName, profile.homeFieldAddress, profile.homeFieldSurface]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" — ");
}

function getMatchVenue(match = {}, fallbackVenue = "") {
  const importedVenue = [match.venueName, match.venueAddress]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" — ");

  if (importedVenue) return importedVenue;
  if (match.location === "Casa" && fallbackVenue) return fallbackVenue;
  return match.location || "";
}

const CONVOCATION_DETAIL_FIELDS = [
  "matchTime",
  "meetingTime",
  "meetingPlace",
  "lockerRoom",
  "kit",
  "staffContact",
  "message",
];

function getDefaultConvocationDetails(match, isHomeMatch, venue) {
  return {
    matchTime: match?.time || "",
    meetingTime: "",
    meetingPlace: isHomeMatch || venue ? venue : "",
    lockerRoom: "",
    kit: "",
    staffContact: "",
    message: "",
  };
}

function normalizeConvocationDetails(details = {}, fallback = {}) {
  return CONVOCATION_DETAIL_FIELDS.reduce((acc, field) => {
    acc[field] = String(details[field] ?? fallback[field] ?? "").trim();
    return acc;
  }, {});
}

function formatMeeting(details = {}) {
  return [details.meetingTime, details.meetingPlace].filter(Boolean).join(" · ");
}

function getPlayerDisplayName(player = {}) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";
}

function buildConvocationText({ clubName, match, details, meetingInfo, sheetVenue, notes, convocati }) {
  const lines = [
    `Convocazione: ${clubName} vs ${match.opponent || "Avversario"}`,
    `Data: ${formatDate(match.date)}`,
    details.matchTime ? `Ora gara: ${details.matchTime}` : "",
    meetingInfo ? `Raduno: ${meetingInfo}` : "",
    sheetVenue ? `Campo: ${sheetVenue}` : "",
    details.lockerRoom ? `Spogliatoio: ${details.lockerRoom}` : "",
    details.kit ? `Kit: ${details.kit}` : "",
    details.staffContact ? `Contatto staff: ${details.staffContact}` : "",
    "",
    "Convocati:",
    ...convocati.map((player, index) => {
      const shirt = player.shirtNumber ? ` #${player.shirtNumber}` : "";
      return `${index + 1}. ${getPlayerDisplayName(player)}${shirt}`;
    }),
    details.message ? `\nMessaggio: ${details.message}` : "",
    notes ? `Note: ${notes}` : "",
  ];

  return lines.filter((line) => line !== "").join("\n");
}

function buildConvocationRosterText(convocati) {
  return convocati
    .map((player, index) => {
      const shirt = player.shirtNumber ? ` #${player.shirtNumber}` : "";
      return `${index + 1}. ${getPlayerDisplayName(player)}${shirt}`;
    })
    .join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function MatchConvocation({ players = [], matches = [], setMatches, appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const match = matches.find((m) => String(m.id) === String(id));
  const existing = match?.convocazione || {};
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const homeVenue = getHomeVenue(workspaceProfile);
  const matchVenue = getMatchVenue(match, homeVenue);
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const isHomeMatch = match?.location === "Casa";
  const defaultNotes = matchVenue
    ? `Raduno presso ${matchVenue}`
    : "";
  const defaultDetails = getDefaultConvocationDetails(match, isHomeMatch, matchVenue);

  const [selectedIds, setSelectedIds] = useState(() =>
    Array.isArray(existing.playerIds) ? existing.playerIds.map(String) : []
  );
  const [notes, setNotes]       = useState(existing.notes || defaultNotes);
  const [details, setDetails] = useState(() =>
    normalizeConvocationDetails(existing.details, defaultDetails)
  );
  const [published, setPublished] = useState(Boolean(existing.published));
  const [saved, setSaved]       = useState(false);
  const [copiedLabel, setCopiedLabel] = useState("");

  // resync se il match cambia dall'esterno
  useEffect(() => {
    const c = match?.convocazione || {};
    const nextMatchVenue = getMatchVenue(match, homeVenue);
    const nextDefaults = getDefaultConvocationDetails(match, isHomeMatch, nextMatchVenue);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(Array.isArray(c.playerIds) ? c.playerIds.map(String) : []);
    setNotes(c.notes || defaultNotes);
    setDetails(normalizeConvocationDetails(c.details, nextDefaults));
    setPublished(Boolean(c.published));
    setCopiedLabel("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, defaultNotes, homeVenue, isHomeMatch, match?.time, match?.venueName, match?.venueAddress]);

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>Partita non trovata.</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>
            Torna alle partite
          </Button>
        </AppCard>
      </div>
    );
  }

  const groups = groupByRole(players);
  const count  = selectedIds.length;
  const full   = count >= MAX_PLAYERS;

  function toggle(pid) {
    const key = String(pid);
    setSaved(false);
    setSelectedIds((prev) =>
      prev.includes(key)
        ? prev.filter((x) => x !== key)
        : full ? prev : [...prev, key]
    );
  }

  function selectAll() {
    setSaved(false);
    setSelectedIds(players.slice(0, MAX_PLAYERS).map((p) => String(p.id)));
  }

  function clearAll() {
    setSaved(false);
    setSelectedIds([]);
  }

  function updateDetails(field, value) {
    setSaved(false);
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  function persistConvocazione(pub) {
    const cleanDetails = normalizeConvocationDetails(details, defaultDetails);
    const newConv = {
      playerIds:   selectedIds,
      notes:       notes.trim(),
      details:     cleanDetails,
      published:   pub,
      publishedAt: pub ? (existing.publishedAt || new Date().toISOString()) : (existing.publishedAt || null),
      sentAt:      existing.sentAt || null,
      sentChannel: existing.sentChannel || "",
    };
    setMatches((prevMatches) =>
      prevMatches.map((m) =>
        String(m.id) === String(id) ? { ...m, convocazione: newConv } : m
      )
    );
    setPublished(pub);
    setSaved(true);
  }

  function printConvocationSheet() {
    window.print();
  }

  async function copyConvocation(kind, text) {
    await copyText(text);
    setCopiedLabel(kind);
    window.setTimeout(() => setCopiedLabel(""), 1800);
  }

  function markAsSent(channel = "WhatsApp") {
    const cleanDetails = normalizeConvocationDetails(details, defaultDetails);
    const sentAt = new Date().toISOString();
    const newConv = {
      ...existing,
      playerIds: selectedIds,
      notes: notes.trim(),
      details: cleanDetails,
      published,
      publishedAt: published ? (existing.publishedAt || sentAt) : (existing.publishedAt || null),
      sentAt,
      sentChannel: channel,
    };

    setMatches((prevMatches) =>
      prevMatches.map((m) =>
        String(m.id) === String(id) ? { ...m, convocazione: newConv } : m
      )
    );
    setSaved(true);
  }

  const subtitle = [
    formatDate(match.date),
    match.time ? `Ore ${match.time}` : null,
    matchVenue || match.location,
    match.result || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const convocati = selectedIds
    .map((pid) => players.find((p) => String(p.id) === pid))
    .filter(Boolean);
  const sheetVenue = matchVenue || match.location;
  const meetingInfo = formatMeeting(details);
  const fullMessage = buildConvocationText({
    clubName,
    match,
    details,
    meetingInfo,
    sheetVenue,
    notes,
    convocati,
  });
  const rosterMessage = buildConvocationRosterText(convocati);

  return (
    <div style={s.page}>
      <PageHeader
        title={`${t("pages.matchConvocation.title")} — ${match.opponent || t("pages.matchConvocation.defaultOpponent")}`}
        subtitle={subtitle}
        badge={published ? "Pubblicata" : "Bozza"}
      />

      <MatchTabBar
        matchId={id}
        active="convocazione"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
        matchData={match}
      />

      {/* ── Barra stato ── */}
      <AppCard>
        <div style={s.topBar}>
          <div style={s.counter}>
            <span style={{ ...s.countNum, color: full ? "#f87171" : "#22c55e" }}>
              {count}
            </span>
            <span style={s.countOf}>/ {MAX_PLAYERS} convocati</span>
            {published && (
              <Badge tone="green" style={{ marginLeft: 8 }}>✓ Pubblicata</Badge>
            )}
            {!published && count > 0 && (
              <Badge tone="orange" style={{ marginLeft: 8 }}>Bozza</Badge>
            )}
          </div>

          <div style={s.topActions}>
            <Button variant="ghost" onClick={clearAll}>Deseleziona tutti</Button>
            <Button variant="ghost" onClick={selectAll}>Seleziona tutti</Button>
            <Button variant="ghost" onClick={() => navigate("/matches")}>Indietro</Button>
            <Button variant="ghost" onClick={() => persistConvocazione(false)} disabled={count === 0}>
              Salva bozza
            </Button>
            <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
              {published ? "Aggiorna pubblicazione" : "Pubblica convocazione"}
            </Button>
          </div>
        </div>

        {saved && (
          <p style={s.savedMsg}>
            {published ? "✓ Convocazione pubblicata." : "✓ Bozza salvata."}
          </p>
        )}
        {published && (
          <div style={s.portalRow}>
            <span style={s.portalMsg}>🎽 Visibile ai giocatori nel portale</span>
            <Button variant="ghost" onClick={() => navigate("/player-portal")}>
              Apri portale →
            </Button>
          </div>
        )}
      </AppCard>

      {/* ── Dettagli professionali convocazione ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 10px", lineHeight: 1.2 }}>Dettagli convocazione</h3>
        <p style={s.muted}>
          Visibili ai giocatori nel portale. Per le gare in casa compiliamo già campo e indirizzo dal profilo società.
        </p>
        <div style={s.formGrid}>
          <label style={s.label}>
            Ora gara
            <input
              type="time"
              value={details.matchTime}
              onChange={(e) => updateDetails("matchTime", e.target.value)}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            Ora raduno
            <input
              type="time"
              value={details.meetingTime}
              onChange={(e) => updateDetails("meetingTime", e.target.value)}
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            Luogo ritrovo
            <input
              value={details.meetingPlace}
              onChange={(e) => updateDetails("meetingPlace", e.target.value)}
              placeholder={matchVenue || homeVenue || "Es. Campo comunale, via Roma 12"}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            Spogliatoio
            <input
              value={details.lockerRoom}
              onChange={(e) => updateDetails("lockerRoom", e.target.value)}
              placeholder="Es. Spogliatoio 3"
              style={s.input}
            />
          </label>
          <label style={s.label}>
            Kit
            <input
              value={details.kit}
              onChange={(e) => updateDetails("kit", e.target.value)}
              placeholder="Es. completo blu, tuta, k-way"
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            Contatto staff
            <input
              value={details.staffContact}
              onChange={(e) => updateDetails("staffContact", e.target.value)}
              placeholder="Es. Team manager 333..."
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            Messaggio ai convocati
            <textarea
              style={s.textarea}
              rows={2}
              placeholder="Es. Presentarsi puntuali con documento, borraccia e materiale gara."
              value={details.message}
              onChange={(e) => updateDetails("message", e.target.value)}
            />
          </label>
        </div>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder={defaultNotes || "Note interne o indicazioni extra per la convocazione"}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        />
      </AppCard>

      {/* ── Comunicazione staff / gruppo squadra ── */}
      <AppCard>
        <div style={s.communicationHeader}>
          <div>
            <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>Comunicazione convocazione</h3>
            <p style={s.muted}>
              Testo pronto per WhatsApp, email o gruppo squadra. La comunicazione resta tracciata sulla partita.
            </p>
          </div>
          <Badge tone={existing.sentAt ? "green" : "orange"}>
            {existing.sentAt
              ? `Inviata${existing.sentChannel ? ` via ${existing.sentChannel}` : ""}`
              : "Da inviare"}
          </Badge>
        </div>

        <textarea
          readOnly
          rows={Math.min(12, Math.max(7, convocati.length + 5))}
          value={fullMessage}
          style={{ ...s.textarea, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
        />

        <div style={s.communicationActions}>
          <Button
            variant="ghost"
            onClick={() => copyConvocation("messaggio", fullMessage)}
            disabled={count === 0}
          >
            Copia testo WhatsApp
          </Button>
          <Button
            variant="ghost"
            onClick={() => copyConvocation("lista", rosterMessage)}
            disabled={count === 0}
          >
            Copia lista convocati
          </Button>
          <Button
            onClick={() => markAsSent("WhatsApp")}
            disabled={count === 0}
          >
            Segna come inviata
          </Button>
        </div>

        <div style={s.communicationFooter}>
          {copiedLabel && <span style={s.copyOk}>Copiato: {copiedLabel}</span>}
          {existing.sentAt && (
            <span style={s.sentInfo}>
              Ultimo invio: {formatDate(existing.sentAt)}
            </span>
          )}
        </div>
      </AppCard>

      {/* ── Selezione giocatori ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 4px", lineHeight: 1.2 }}>Seleziona convocati</h3>
        <p style={s.muted}>
          Clicca per selezionare/deselezionare. Massimo {MAX_PLAYERS} giocatori.
          {full && <span style={{ color: "#f87171", marginLeft: 6 }}>Limite raggiunto.</span>}
        </p>

        <div style={s.groups}>
          {Object.entries(groups).map(([role, rolePlayers]) => {
            const meta = ROLE_LABEL[role] || { short: "?", tone: "blue" };
            return (
              <div key={role} style={s.roleGroup}>
                <div style={s.roleHeader}>
                  <Badge tone={meta.tone}>{meta.short}</Badge>
                  <span style={s.roleLabel}>{role}</span>
                  <span style={s.roleCount}>
                    {rolePlayers.filter((p) => selectedIds.includes(String(p.id))).length}/{rolePlayers.length}
                  </span>
                </div>

                <div style={s.playerGrid}>
                  {rolePlayers.map((player) => {
                    const pid      = String(player.id);
                    const selected = selectedIds.includes(pid);
                    const disabled = !selected && full;
                    const displayName =
                      [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                      player.name || "—";

                    return (
                      <button
                        key={pid}
                        onClick={() => !disabled && toggle(pid)}
                        style={{
                          ...s.playerBtn,
                          ...(selected ? s.playerBtnSelected : {}),
                          ...(disabled ? s.playerBtnDisabled : {}),
                        }}
                      >
                        <span style={s.shirtNum}>
                          {player.shirtNumber || "—"}
                        </span>
                        <span style={s.playerBtnName}>{displayName}</span>
                        {selected && <span style={s.checkMark}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </AppCard>

      {/* ── Foglio convocazione ── */}
      {count > 0 && (
        <AppCard>
          <div style={s.sheetToolbar}>
            <h3 style={{ margin: 0, lineHeight: 1.2 }}>
              Foglio convocazione
              {!published && <span style={{ ...s.muted, marginLeft: 8, fontSize: 13 }}>(bozza)</span>}
            </h3>
            <div style={s.sheetToolbarActions}>
              <Button variant="ghost" onClick={printConvocationSheet}>
                Stampa / PDF
              </Button>
              <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
                {published ? "Aggiorna pubblicazione" : "Pubblica adesso"}
              </Button>
            </div>
          </div>

          <div className="print-area print-template" style={s.printSheet}>
            <article>
              <div className="print-header" style={s.printHeader}>
                <div style={s.printBrand}>
                  <TeamLogo logo={clubLogo} logoSize={clubLogoSize} name={clubName} />
                  <div>
                    <p>Foglio convocazione</p>
                    <h1>
                      {clubName} <span style={{ color: "#64748b" }}>vs</span> {match.opponent || "Avversario"}
                    </h1>
                  </div>
                </div>
                <div className="print-meta">
                  <span>{formatDate(match.date)}</span>
                  {details.matchTime && <span>Gara {details.matchTime}</span>}
                  <span>{published ? "Pubblicata" : "Bozza"}</span>
                  <span>{count} convocati</span>
                </div>
              </div>

              <section className="print-grid two">
                <div className="print-box">
                  <span>Raduno</span>
                  <p>{meetingInfo || "Da definire"}</p>
                </div>
                <div className="print-box">
                  <span>Campo</span>
                  <p>{sheetVenue || "Da definire"}</p>
                </div>
                <div className="print-box">
                  <span>Spogliatoio</span>
                  <p>{details.lockerRoom || "Da definire"}</p>
                </div>
                <div className="print-box">
                  <span>Kit gara</span>
                  <p>{details.kit || "Da definire"}</p>
                </div>
              </section>

              {(details.staffContact || details.message || notes) && (
                <section className="print-grid two">
                  {details.staffContact && (
                    <div className="print-box">
                      <span>Contatto staff</span>
                      <p>{details.staffContact}</p>
                    </div>
                  )}
                  {details.message && (
                    <div className="print-box">
                      <span>Comunicazione ai convocati</span>
                      <p>{details.message}</p>
                    </div>
                  )}
                  {notes && (
                    <div className="print-box">
                      <span>Note</span>
                      <p>{notes}</p>
                    </div>
                  )}
                </section>
              )}

              <section className="print-section">
                <h2>Lista convocati</h2>
                <table>
                  <thead>
                    <tr>
                      <th>N.</th>
                      <th>Maglia</th>
                      <th>Giocatore</th>
                      <th>Ruolo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convocati.map((player, index) => {
                      const displayName =
                        [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                        player.name || "—";

                      return (
                        <tr key={player.id}>
                          <td>{index + 1}</td>
                          <td>#{player.shirtNumber || "—"}</td>
                          <td>{displayName}</td>
                          <td>{player.role || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="print-grid two">
                <div className="print-box">
                  <span>Firma staff</span>
                  <p style={s.signatureLine} />
                </div>
                <div className="print-box">
                  <span>Comunicata il</span>
                  <p>{published && existing.publishedAt ? formatDate(existing.publishedAt) : "Da pubblicare"}</p>
                </div>
              </section>
            </article>
          </div>

          <div style={s.previewActions}>
            <Button variant="ghost" onClick={() => persistConvocazione(false)}>
              Salva bozza
            </Button>
          </div>
        </AppCard>
      )}
    </div>
  );
}

function TeamLogo({ logo, logoSize = 100, name }) {
  const fallback = (name || "CL").slice(0, 2).toUpperCase();
  return (
    <div style={s.printLogoFrame}>
      {logo ? (
        <img
          src={logo}
          alt={name || "Logo società"}
          style={{
            maxWidth: `${Number(logoSize || 100)}%`,
            maxHeight: `${Number(logoSize || 100)}%`,
            objectFit: "contain",
          }}
        />
      ) : (
        <span style={s.printLogoFallback}>{fallback}</span>
      )}
    </div>
  );
}

const s = {
  page:    { display: "grid", gap: 18 },
  muted:   { color: "#94a3b8", margin: 0 },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  counter: { display: "flex", alignItems: "center", gap: 6 },
  countNum: { fontSize: 36, fontWeight: 900, lineHeight: 1 },
  countOf:  { fontSize: 16, color: "#64748b", fontWeight: 600 },
  topActions: { display: "flex", gap: 8, flexWrap: "wrap" },

  savedMsg: {
    marginTop: 12,
    marginBottom: 0,
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 600,
  },
  portalRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 10,
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.2)",
    flexWrap: "wrap",
  },
  portalMsg: {
    flex: 1,
    fontSize: 13,
    fontWeight: 700,
    color: "#86efac",
  },

  textarea: {
    marginTop: 10,
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 16,
  },
  label: {
    display: "grid",
    gap: 6,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0,
    minWidth: 0,
  },
  labelFull: {
    display: "grid",
    gap: 6,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0,
    minWidth: 0,
    gridColumn: "1 / -1",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.4,
    outline: "none",
  },
  communicationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  communicationActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
  communicationFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
    minHeight: 18,
  },
  copyOk: {
    color: "#86efac",
    fontSize: 13,
    fontWeight: 800,
  },
  sentInfo: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },

  groups: { display: "grid", gap: 18, marginTop: 16 },

  roleGroup: {},
  roleHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  roleLabel: { fontSize: 14, fontWeight: 700, color: "#cbd5e1" },
  roleCount: { fontSize: 12, color: "#475569", marginLeft: "auto" },

  playerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 8,
  },
  playerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s, border-color 0.15s",
  },
  playerBtnSelected: {
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
  },
  playerBtnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  shirtNum: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
  },
  playerBtnName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  checkMark: { color: "#22c55e", fontWeight: 900, fontSize: 14 },

  sheetToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sheetToolbarActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  previewActions: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-end",
  },
  printSheet: {
    borderRadius: 18,
    overflow: "hidden",
  },
  printHeader: {
    alignItems: "center",
  },
  printBrand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
  },
  printLogoFrame: {
    width: 72,
    height: 72,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    flex: "0 0 auto",
  },
  printLogoFallback: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
  },
  signatureLine: {
    minHeight: 28,
    borderBottom: "1px solid #94a3b8",
  },

  // Anteprima foglio legacy
  sheetHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 20,
    alignItems: "start",
    padding: "16px 0 20px",
    borderBottom: "2px solid rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  sheetLabel: {
    margin: "0 0 4px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#64748b",
  },
  sheetTitle: { margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.12 },
  sheetMeta:  { display: "grid", gap: 6, textAlign: "right" },

  sheetList: {
    display: "grid",
    gap: 4,
  },
  sheetRow: {
    display: "grid",
    gridTemplateColumns: "28px 44px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  sheetIndex: { color: "#475569", fontSize: 12, fontWeight: 700, textAlign: "right" },
  sheetShirt: { color: "#64748b", fontSize: 12, fontWeight: 800, textAlign: "center" },
  sheetName:  { fontSize: 14, fontWeight: 600, color: "#e2e8f0" },
};
