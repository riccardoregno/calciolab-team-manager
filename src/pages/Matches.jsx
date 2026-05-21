import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

import { styles } from "../styles/index.js";
import { createId, formatDate, normalizeAppSettings } from "../utils/helpers";

function Matches({ matches, setMatches, players = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const [confirmState, setConfirmState] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyMatch());
  const [importSummary, setImportSummary] = useState(null);

  function handleLogoUpload(field, file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        [field]: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function saveMatch() {
    if (!form.opponent.trim()) {
      showToast(t("pages.matches.missingOpponent"), "warn");
      return;
    }

    const payload = {
      ...form,
      id: editingId || createId("match"),
      type: "Partita",
      title: `${clubName} - ${form.opponent}`,
      homeLogo: form.homeLogo || clubLogo,
    };

    if (editingId) {
      setMatches((prevMatches) => prevMatches.map((m) => (m.id === editingId ? payload : m)));
    } else {
      setMatches((prevMatches) => [...prevMatches, payload]);
    }

    setForm(emptyMatch(clubLogo));
    setEditingId(null);
    setOpenModal(false);
    showToast(editingId ? t("pages.matches.matchUpdated") : t("pages.matches.matchSaved"), "ok");
  }

  function editMatch(match) {
    setEditingId(match.id);

    setForm({
      opponent: match.opponent || "",
      date: match.date || new Date().toISOString().slice(0, 10),
      time: match.time || "",
      location: match.location || "Casa",
      result: match.result || "",
      formation: match.formation || "4-2-3-1",
      notes: match.notes || "",
      competition: match.competition || "",
      matchday: match.matchday || "",
      venueName: match.venueName || "",
      venueAddress: match.venueAddress || "",
      attendance: match.attendance || {},
      homeLogo: match.homeLogo || "",
      awayLogo: match.awayLogo || "",
      lineup: match.lineup || emptyLineup(),
      matchPlan: match.matchPlan || "",
      staffNotes: match.staffNotes || "",
    });

    setOpenModal(true);
  }

  function openNewMatch() {
    setEditingId(null);
    setForm(emptyMatch(clubLogo));
    setOpenModal(true);
  }

  function importCalendar(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ""));
      const imported = rows
        .map((row) => calendarRowToMatch(row, clubLogo, clubName))
        .filter(Boolean);

      if (!imported.length) {
        showToast(t("pages.matches.noValidMatches"), "warn");
        return;
      }

      setMatches((prevMatches) => {
        const existingKeys = new Set(prevMatches.map(getMatchIdentity));
        const uniqueImported = imported.filter((match) => !existingKeys.has(getMatchIdentity(match)));
        const nextMatches = [...prevMatches, ...uniqueImported].sort(sortMatchesByDate);

        setImportSummary({
          total: imported.length,
          added: uniqueImported.length,
          skipped: imported.length - uniqueImported.length,
          fileName: file.name,
        });

        showToast(t("pages.matches.matchesImported", { count: uniqueImported.length }), uniqueImported.length ? "ok" : "info");
        return nextMatches;
      });
    };
    reader.readAsText(file);
  }

  function deleteMatch(id) {
    setConfirmState({
      message: t("pages.matches.deleteConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        setMatches((prevMatches) => prevMatches.filter((match) => match.id !== id));
        showToast(t("pages.matches.matchDeleted"), "info");
      },
    });
  }

  return (
    <div style={styles.page}>
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <ToastContainer />
      <PageHeader
        title={t("pages.matches.title")}
        subtitle={t("pages.matches.subtitle")}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link to="/match-day" style={{ textDecoration: "none" }}>
              <Button variant="ghost">{t("pages.matches.matchDay")}</Button>
            </Link>
            <label style={{ display: "inline-flex" }}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => importCalendar(event.target.files?.[0])}
                style={{ display: "none" }}
              />
              <Button variant="ghost">{t("pages.matches.importCsv")}</Button>
            </label>
            <Button onClick={openNewMatch}>{t("pages.matches.newMatch")}</Button>
          </div>
        }
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "flex-start",
          marginBottom: 22,
          flexWrap: "wrap",
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Badge tone="blue">{matches.length} {t("pages.matches.matchesCount")}</Badge>
        <p style={{ color: "#94a3b8", margin: 0, lineHeight: 1.45 }}>
          {t("pages.matches.archiveSubtitle")}
        </p>
      </div>

      {importSummary && (
        <AppCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>Import calendario completato</h3>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                {importSummary.fileName} · {importSummary.added} gare aggiunte
                {importSummary.skipped > 0 ? ` · ${importSummary.skipped} duplicate ignorate` : ""}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setImportSummary(null)}>Nascondi</Button>
          </div>
        </AppCard>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title={t("pages.matches.noMatchesTitle")}
          text={t("pages.matches.noMatchesText")}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 18,
          }}
        >
          {matches.map((match) => (
            <AppCard key={match.id}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 14,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <TeamBox
                  logo={match.homeLogo}
                  logoSize={clubLogoSize}
                  name={clubName}
                  fallback={clubName.slice(0, 2).toUpperCase()}
                  gradient="linear-gradient(135deg,#2563eb,#38bdf8)"
                />

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {match.result || "-"}
                  </div>

                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    {formatDate(match.date)}
                  </p>
                </div>

                <TeamBox
                  logo={match.awayLogo}
                  name={match.opponent}
                  fallback={match.opponent?.[0] || "A"}
                  gradient="linear-gradient(135deg,#7c3aed,#c084fc)"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                  <MiniInfo label={t("pages.matches.field")} value={formatMatchVenue(match)} />
                  <MiniInfo label={t("pages.matches.formation")} value={match.formation || "-"} />
                  <MiniInfo
                  label={t("pages.matches.calledUp")}
                  value={`${match.lineup?.calledUpIds?.length || 0}/${players.length}`}
                />
              </div>

              <div
                style={{
                  borderRadius: 12,
                  padding: 16,
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minHeight: 90,
                }}
              >
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0,
                    marginBottom: 8,
                  }}
                >
                  {t("pages.matches.matchNotes")}
                </div>

                <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
                  {match.notes || t("pages.matches.noNotes")}
                </p>
              </div>

              {/* Badge convocazione */}
              {match.convocazione?.published && (
                <div style={{ marginBottom: 10, marginTop: 14 }}>
                  <Badge tone="green">
                    ✓ {t("pages.matches.convocationPublished")} · {match.convocazione.playerIds?.length || 0} {t("common.players")}
                  </Badge>
                </div>
              )}
              {match.convocazione && !match.convocazione.published && match.convocazione.playerIds?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <Badge tone="orange">
                    {t("pages.matches.convocationDraft")} · {match.convocazione.playerIds.length} {t("pages.matches.selected")}
                  </Badge>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <Link
                  to={`/match-convocation/${match.id}`}
                  style={{ flex: 1, textDecoration: "none", minWidth: 110 }}
                >
                  <Button
                    variant={match.convocazione?.published ? "ghost" : "primary"}
                    style={{ width: "100%" }}
                  >
                    {match.convocazione?.published ? `✓ ${t("pages.matches.convocation")}` : t("pages.matches.callUp")}
                  </Button>
                </Link>

                <Link
                  to={`/match-day/${match.id}`}
                  style={{ flex: 1, textDecoration: "none", minWidth: 100 }}
                >
                  <Button variant="ghost" style={{ width: "100%" }}>
                    {t("pages.matches.matchSheet")}
                  </Button>
                </Link>

                <Link
                  to={`/match-stats/${match.id}`}
                  style={{ flex: 1, textDecoration: "none", minWidth: 100 }}
                >
                  <Button variant="ghost" style={{ width: "100%" }}>
                    {t("pages.matches.statistics")}
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  onClick={() => editMatch(match)}
                  style={{ flex: 1, minWidth: 90 }}
                >
                  {t("common.edit")}
                </Button>

                <Button
                  variant="danger"
                  onClick={() => deleteMatch(match.id)}
                  style={{ flex: 1, minWidth: 80 }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {openModal && (
        <Modal
          title={editingId ? t("pages.matches.editMatch") : t("pages.matches.newMatchTitle")}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);
            setForm(emptyMatch(clubLogo));
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            <input
              placeholder={t("pages.matches.opponentPlaceholder")}
              value={form.opponent}
              onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              style={styles.input}
            />

            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={styles.input}
            />

            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              style={styles.input}
            />

            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={styles.input}
            >
              <option value="Casa">{t("pages.matches.home")}</option>
              <option value="Trasferta">{t("pages.matches.away")}</option>
              <option value="Neutro">{t("pages.matches.neutral")}</option>
            </select>

            <input
              placeholder={t("pages.matches.resultPlaceholder")}
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Competizione / girone"
              value={form.competition}
              onChange={(e) => setForm({ ...form, competition: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Giornata"
              value={form.matchday}
              onChange={(e) => setForm({ ...form, matchday: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Nome campo"
              value={form.venueName}
              onChange={(e) => setForm({ ...form, venueName: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder="Indirizzo campo"
              value={form.venueAddress}
              onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
              style={styles.input}
            />

            <select
              value={form.formation}
              onChange={(e) => setForm({ ...form, formation: e.target.value })}
              style={styles.input}
            >
              <option>4-2-3-1</option>
              <option>4-3-3</option>
              <option>4-4-2</option>
              <option>3-5-2</option>
              <option>3-4-2-1</option>
              <option>4-3-1-2</option>
            </select>

            <LogoUploader
              label={t("pages.matches.homeLogo")}
              value={form.homeLogo}
              onChange={(file) => handleLogoUpload("homeLogo", file)}
            />

            <LogoUploader
              label={t("pages.matches.awayLogo")}
              value={form.awayLogo}
              onChange={(file) => handleLogoUpload("awayLogo", file)}
            />

            <textarea
              placeholder={t("pages.matches.notesPlaceholder")}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={{
                ...styles.input,
                minHeight: 120,
                gridColumn: "1 / -1",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 24,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => {
                setOpenModal(false);
                setEditingId(null);
                setForm(emptyMatch(clubLogo));
              }}
            >
              {t("common.cancel")}
            </Button>

            <Button onClick={saveMatch}>
              {editingId ? t("pages.matches.updateMatch") : t("pages.matches.saveMatch")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TeamBox({ logo, logoSize = 100, name, fallback, gradient }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      {logo ? (
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            marginBottom: 10,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <img
            src={logo}
            alt={name}
            style={{
              width: `${Number(logoSize || 100)}%`,
              height: `${Number(logoSize || 100)}%`,
              objectFit: "contain",
              maxWidth: "160%",
              maxHeight: "160%",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            background: gradient,
            display: "grid",
            placeItems: "center",
            marginBottom: 10,
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          {fallback}
        </div>
      )}

      <strong
        style={{
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {name}
      </strong>
    </div>
  );
}

function LogoUploader({ label, value, onChange }) {
  return (
    <div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files[0])}
        style={styles.input}
      />

      {value && (
        <img
          src={value}
          alt={label}
          style={{
            width: 58,
            height: 58,
            objectFit: "cover",
            borderRadius: 14,
            marginTop: 10,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
      )}
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0,
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <strong style={{ lineHeight: 1.2 }}>{value}</strong>
    </div>
  );
}

function emptyMatch(homeLogo = "") {
  return {
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    location: "Casa",
    result: "",
    formation: "4-2-3-1",
    notes: "",
    competition: "",
    matchday: "",
    venueName: "",
    venueAddress: "",
    attendance: {},
    lineup: emptyLineup(),
    matchPlan: "",
    staffNotes: "",
    homeLogo,
    awayLogo: "",
  };
}

function emptyLineup() {
  return {
    calledUpIds: [],
    starterIds: [],
    benchIds: [],
  };
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => normalizeHeader(header));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === "\"") {
      quoted = !quoted;
    } else if ((char === "," || char === ";") && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, ""));
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[àá]/g, "a")
    .replace(/[èé]/g, "e")
    .replace(/[ìí]/g, "i")
    .replace(/[òó]/g, "o")
    .replace(/[ùú]/g, "u");
}

function pick(row, keys) {
  return keys.map((key) => row[key]).find((value) => String(value || "").trim()) || "";
}

function calendarRowToMatch(row, clubLogo, clubName) {
  const opponent = pick(row, ["avversario", "opponent", "squadra", "team", "contro"]);
  const date = normalizeDate(pick(row, ["data", "date", "giorno"]));
  if (!opponent || !date) return null;

  const locationRaw = pick(row, ["campo", "location", "casa_trasferta", "sede"]);
  const location = /trasf|away|fuori/i.test(locationRaw)
    ? "Trasferta"
    : /neut/i.test(locationRaw)
      ? "Neutro"
      : "Casa";
  const competition = pick(row, ["competizione", "competition", "campionato", "torneo"]);
  const time = normalizeTime(pick(row, ["ora", "orario", "time", "kickoff", "inizio"]));
  const venueName = pick(row, ["nome_campo", "campo_nome", "impianto", "stadio", "venue", "field"]);
  const venueAddress = pick(row, ["indirizzo", "indirizzo_campo", "address", "via"]);

  return {
    ...emptyMatch(clubLogo),
    id: createId("match"),
    type: "Partita",
    opponent,
    date,
    time,
    location,
    competition,
    matchday: pick(row, ["giornata", "turno", "round", "matchday"]),
    venueName,
    venueAddress,
    result: pick(row, ["risultato", "result"]),
    formation: pick(row, ["modulo", "formation"]) || "4-2-3-1",
    notes: pick(row, ["note", "notes"]),
    title: `${clubName} - ${opponent}`,
  };
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function normalizeTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::|\.)(\d{2})$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function getMatchIdentity(match) {
  return [
    String(match.date || "").trim(),
    String(match.time || "").trim(),
    String(match.opponent || "").trim().toLowerCase(),
    String(match.location || "").trim().toLowerCase(),
  ].join("|");
}

function sortMatchesByDate(a, b) {
  const aKey = `${a.date || ""}T${a.time || "00:00"}`;
  const bKey = `${b.date || ""}T${b.time || "00:00"}`;
  return new Date(aKey) - new Date(bKey);
}

function formatMatchVenue(match) {
  return [
    match.location,
    match.venueName,
    match.venueAddress,
  ].filter(Boolean).join(" · ") || "-";
}

export default Matches;
