import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";

import PageHeader from "../components/ui/PageHeader";
import ActionBar from "../components/ui/ActionBar";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonList } from "../components/ui/Skeleton";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAreaPermission } from "../components/auth/permissionContext";
import { useIsMobile } from "../hooks/useIsMobile";

import { styles } from "../styles/index.js";
import { createId, formatDate, normalizeAppSettings, parseMatchResult } from "../utils/helpers";

const MATCH_MODAL_QUERY = "match";
const MATCH_DRAFT_KEY = "calciolab_match_draft_v1";
const STATUS_LABEL_KEYS = {
  Vinta: "pages.matches.statusWon",
  Persa: "pages.matches.statusLost",
  Pareggio: "pages.matches.statusDraw",
  "In programma": "pages.matches.statusScheduled",
};
const LOCATION_LABEL_KEYS = {
  Casa: "pages.matches.home",
  Trasferta: "pages.matches.away",
  Neutro: "pages.matches.neutral",
};

function getMatchStatusLabel(status, t) {
  return t(STATUS_LABEL_KEYS[status] || STATUS_LABEL_KEYS["In programma"]);
}

function getMatchStatusTone(status) {
  if (status === "Vinta") return "green";
  if (status === "Persa") return "red";
  if (status === "Pareggio") return "orange";
  return "blue";
}

function translateLocation(location, t) {
  return t(LOCATION_LABEL_KEYS[location] || LOCATION_LABEL_KEYS.Casa);
}

function Matches({ matches, setMatches, players = [], appSettings = {}, loading = false }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const searchParams = new URLSearchParams(location.search);
  const openModal = searchParams.get("modal") === MATCH_MODAL_QUERY;
  const modalEditId = searchParams.get("edit") || "";
  const modalKeyRef = useRef("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => loadMatchDraft(`${MATCH_DRAFT_KEY}:new`, emptyMatch(clubLogo)));
  const [formErrors, setFormErrors] = useState({});
  const [importSummary, setImportSummary] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!openModal) {
      modalKeyRef.current = "";
      return;
    }

    const draftKey = `${MATCH_DRAFT_KEY}:${modalEditId || "new"}`;
    if (modalKeyRef.current === draftKey) return;

    modalKeyRef.current = draftKey;

    if (modalEditId) {
      const match = matches.find((item) => String(item.id) === String(modalEditId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingId(modalEditId);
      setForm(loadMatchDraft(draftKey, match ? matchToForm(match) : emptyMatch(clubLogo)));
      return;
    }

    setEditingId(null);
    const fallback = emptyMatch(clubLogo);
    let stored = null;
    try { stored = localStorage.getItem(draftKey); } catch { /* noop */ }
    setForm(loadMatchDraft(draftKey, fallback));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if ((parsed.opponent || "").trim() || parsed.date) {
          showToast(t("pages.matches.draftRestored"), "info", {
            action: {
              label: t("pages.matches.discardDraft"),
              fn: () => {
                try { localStorage.removeItem(draftKey); } catch { /* noop */ }
                setForm(emptyMatch(clubLogo));
              },
            },
            duration: 6000,
          });
        }
      } catch { /* noop */ }
    }
  }, [clubLogo, matches, modalEditId, openModal, showToast, t]);

  useEffect(() => {
    if (!openModal || !modalKeyRef.current) return;
    try {
      localStorage.setItem(modalKeyRef.current, JSON.stringify(form));
    } catch {
      /* localStorage can be unavailable in restricted browsers */
    }
  }, [form, openModal]);

  function handleLogoUpload(field, file) {
    if (!canManage) return;
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
    if (!canManage) return;
    if (savingRef.current) return;
    const errors = {};
    if (!form.opponent.trim()) errors.opponent = true;
    if (!form.date) errors.date = true;
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast(t("pages.matches.missingOpponent"), "warn");
      return;
    }
    setFormErrors({});
    savingRef.current = true;

    // Calcola result dalla coppia strutturata; se i campi sono vuoti la partita è "In programma"
    const computedResult =
      form.goalsFor !== "" && form.goalsAgainst !== ""
        ? `${Number(form.goalsFor)}-${Number(form.goalsAgainst)}`
        : "";

    const payload = {
      ...form,
      result: computedResult,
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

    clearMatchDraft(editingId || "new");
    setForm(emptyMatch(clubLogo));
    closeMatchModal();
    showToast(editingId ? t("pages.matches.matchUpdated") : t("pages.matches.matchSaved"), "ok");
    setTimeout(() => { savingRef.current = false; }, 500);
  }

  function editMatch(match) {
    if (!canManage) return;
    openMatchModal(match.id);
  }

  function openNewMatch() {
    if (!canManage) return;
    openMatchModal();
  }

  function openMatchModal(editId = "") {
    const params = new URLSearchParams(location.search);
    params.set("modal", MATCH_MODAL_QUERY);
    if (editId) params.set("edit", String(editId));
    else params.delete("edit");
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
  }

  function closeMatchModal({ resetDraft = false } = {}) {
    if (resetDraft) clearMatchDraft(editingId || modalEditId || "new");
    const params = new URLSearchParams(location.search);
    params.delete("modal");
    params.delete("edit");
    const nextSearch = params.toString();
    setEditingId(null);
    setForm(emptyMatch(clubLogo));
    setFormErrors({});
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true }
    );
  }

  function importCalendar(file) {
    if (!canManage) return;
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

      const existingKeys = new Set(matches.map(getMatchIdentity));
      const uniqueImported = imported.filter((match) => !existingKeys.has(getMatchIdentity(match)));
      const duplicates = imported.filter((match) => existingKeys.has(getMatchIdentity(match)));

      setImportPreview({
        fileName: file.name,
        total: imported.length,
        newMatches: uniqueImported.sort(sortMatchesByDate),
        duplicates,
      });
    };
    reader.readAsText(file);
  }

  function confirmCalendarImport() {
    if (!canManage) return;
    const newMatches = importPreview?.newMatches || [];
    setMatches((prevMatches) => [...prevMatches, ...newMatches].sort(sortMatchesByDate));
    setImportSummary({
      total: importPreview?.total || 0,
      added: newMatches.length,
      skipped: importPreview?.duplicates?.length || 0,
      fileName: importPreview?.fileName || "",
    });
    setImportPreview(null);
    showToast(t("pages.matches.matchesImported", { count: newMatches.length }), newMatches.length ? "ok" : "info");
  }

  function deleteMatch(id) {
    if (!canManage) return;
    const removed = matches.find((m) => m.id === id);
    if (!removed) return;
    setConfirmState({
      message: t("pages.matches.deleteConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        setMatches((prev) => prev.filter((m) => m.id !== id));
        showToast(t("pages.matches.matchDeleted"), "info", {
          duration: 5000,
          action: {
            label: t("common.undo"),
            fn: () => setMatches((prev) => [...prev, removed].sort(sortMatchesByDate)),
          },
        });
      },
    });
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.matches.title")}
        subtitle={t("pages.matches.subtitle")}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link to="/match-day" style={{ textDecoration: "none" }}>
              <Button variant="ghost">{t("pages.matches.matchDay")}</Button>
            </Link>
            {canManage && (
              <>
                <label style={{ display: "inline-flex" }}>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      importCalendar(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <Button variant="ghost">{t("pages.matches.importCsv")}</Button>
                </label>
                <Button onClick={openNewMatch}>{t("pages.matches.newMatch")}</Button>
              </>
            )}
          </div>
        }
      />

      <ActionBar
        eyebrow={t("pages.matches.title")}
        title={`${matches.length} ${t("pages.matches.matchesCount")}`}
        subtitle={t("pages.matches.archiveSubtitle")}
        meta={<Badge tone="blue">{matches.length} {t("pages.matches.matchesCount")}</Badge>}
      />

      {importSummary && (
        <AppCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>{t("pages.matches.importCompleted")}</h3>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                {importSummary.fileName} · {importSummary.added} {t("pages.matches.matchesAdded")}
                {importSummary.skipped > 0 ? ` · ${importSummary.skipped} ${t("pages.matches.duplicatesIgnored")}` : ""}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setImportSummary(null)}>{t("pages.matches.hideImport")}</Button>
          </div>
        </AppCard>
      )}

      {loading && matches.length === 0 ? (
        <SkeletonList rows={4} cols={3} />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="🏟️"
          title={t("pages.matches.noMatchesTitle")}
          text={t("pages.matches.noMatchesText")}
          action={
            canManage ? <button
              onClick={openNewMatch}
              style={{
                marginTop: 12, padding: "9px 20px", borderRadius: 10,
                background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
                color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("pages.matches.newMatch")}
            </button> : null
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(320px,1fr))",
            gap: isMobile ? 12 : 18,
          }}
        >
          {matches.map((match) => (
            <AppCard key={match.id}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "minmax(0,1fr) auto minmax(0,1fr)" : "1fr auto 1fr",
                  gap: isMobile ? 8 : 14,
                  alignItems: "center",
                  marginBottom: isMobile ? 14 : 20,
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
                      fontSize: isMobile ? 24 : 32,
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
                  <div style={{ marginTop: 8 }}>
                    <Badge tone={getMatchStatusTone(getMatchStatus(match))}>
                      {getMatchStatusLabel(getMatchStatus(match), t)}
                    </Badge>
                  </div>
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
                  gap: isMobile ? 8 : 12,
                  marginBottom: isMobile ? 12 : 18,
                }}
              >
                  <MiniInfo label={t("pages.matches.field")} value={formatMatchVenue(match, t)} />
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

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(90px, 1fr))", gap: isMobile ? 8 : 10, marginTop: 14 }}>
                <Link
                  to={`/match-convocation/${match.id}`}
                  style={{ textDecoration: "none", minWidth: 0 }}
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
                  style={{ textDecoration: "none", minWidth: 0 }}
                >
                  <Button variant="ghost" style={{ width: "100%" }}>
                    {t("pages.matches.matchSheet")}
                  </Button>
                </Link>

                <Link
                  to={`/match-stats/${match.id}`}
                  style={{ textDecoration: "none", minWidth: 0 }}
                >
                  <Button variant="ghost" style={{ width: "100%" }}>
                    {t("pages.matches.statistics")}
                  </Button>
                </Link>

                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => editMatch(match)}
                      style={{ minWidth: 0 }}
                    >
                      {t("common.edit")}
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => deleteMatch(match.id)}
                      style={{ minWidth: 0 }}
                    >
                      {t("common.delete")}
                    </Button>
                  </>
                )}
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {openModal && (
        <Modal
          title={editingId ? t("pages.matches.editMatch") : t("pages.matches.newMatchTitle")}
          onClose={() => closeMatchModal()}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            <div>
              <input
                placeholder={t("pages.matches.opponentPlaceholder")}
                value={form.opponent}
                onChange={(e) => { setForm({ ...form, opponent: e.target.value }); if (formErrors.opponent) setFormErrors((p) => ({ ...p, opponent: false })); }}
                style={{ ...styles.input, ...(formErrors.opponent ? matchStyles.inputError : {}) }}
              />
              {formErrors.opponent && <span style={matchStyles.errorMsg}>{t("pages.matches.missingOpponent")}</span>}
            </div>

            <div>
              <input
                type="date"
                value={form.date}
                onChange={(e) => { setForm({ ...form, date: e.target.value }); if (formErrors.date) setFormErrors((p) => ({ ...p, date: false })); }}
                style={{ ...styles.input, ...(formErrors.date ? matchStyles.inputError : {}) }}
              />
              {formErrors.date && <span style={matchStyles.errorMsg}>{t("pages.matches.dateRequired")}</span>}
            </div>

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

            {/* Risultato strutturato: due campi numerici separati da "–" */}
            <label style={{ display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
              <span>{t("pages.matches.scoreLabel")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  max="99"
                  aria-label={t("pages.matches.scoreHome")}
                  placeholder="0"
                  value={form.goalsFor}
                  onChange={(e) => setForm({ ...form, goalsFor: e.target.value })}
                  style={{ ...styles.input, textAlign: "center", flex: 1 }}
                />
                <span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 22, lineHeight: 1, flexShrink: 0 }}>–</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  aria-label={t("pages.matches.scoreAway")}
                  placeholder="0"
                  value={form.goalsAgainst}
                  onChange={(e) => setForm({ ...form, goalsAgainst: e.target.value })}
                  style={{ ...styles.input, textAlign: "center", flex: 1 }}
                />
              </div>
            </label>

            <input
              placeholder={t("pages.matches.competitionPlaceholder")}
              value={form.competition}
              onChange={(e) => setForm({ ...form, competition: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder={t("pages.matches.matchdayPlaceholder")}
              value={form.matchday}
              onChange={(e) => setForm({ ...form, matchday: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder={t("pages.matches.venueNamePlaceholder")}
              value={form.venueName}
              onChange={(e) => setForm({ ...form, venueName: e.target.value })}
              style={styles.input}
            />

            <input
              placeholder={t("pages.matches.venueAddressPlaceholder")}
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
              onClick={() => closeMatchModal({ resetDraft: true })}
            >
              {t("common.cancel")}
            </Button>

            <Button onClick={saveMatch}>
              {editingId ? t("pages.matches.updateMatch") : t("pages.matches.saveMatch")}
            </Button>
          </div>
        </Modal>
      )}

      {importPreview && (
        <Modal
          title={t("pages.matches.importPreviewTitle")}
          onClose={() => setImportPreview(null)}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div style={previewStyles.summaryGrid}>
              <PreviewStat label={t("pages.matches.importFile")} value={importPreview.fileName} />
              <PreviewStat label={t("pages.matches.importRead")} value={importPreview.total} />
              <PreviewStat label={t("pages.matches.importNew")} value={importPreview.newMatches.length} tone="#86efac" />
              <PreviewStat label={t("pages.matches.importDuplicates")} value={importPreview.duplicates.length} tone="#fbbf24" />
            </div>

            <div>
              <h3 style={previewStyles.title}>{t("pages.matches.matchesToImport")}</h3>
              {importPreview.newMatches.length === 0 ? (
                <p style={previewStyles.muted}>{t("pages.matches.noNewMatches")}</p>
              ) : (
                <div style={previewStyles.tableWrap}>
                  <table style={previewStyles.table}>
                    <thead>
                      <tr>
                        <th style={previewStyles.th}>{t("common.date")}</th>
                        <th style={previewStyles.th}>{t("pages.matches.importTimeCol")}</th>
                        <th style={previewStyles.th}>{t("pages.matches.opponentPlaceholder")}</th>
                        <th style={previewStyles.th}>{t("pages.matches.importVenueType")}</th>
                        <th style={previewStyles.th}>{t("pages.matches.importVenueName")}</th>
                        <th style={previewStyles.th}>{t("pages.matches.importCompetition")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.newMatches.map((match) => (
                        <tr key={getMatchIdentity(match)}>
                          <td style={previewStyles.td}>{formatDate(match.date)}</td>
                          <td style={previewStyles.td}>{match.time || "-"}</td>
                          <td style={previewStyles.td}>{match.opponent}</td>
                          <td style={previewStyles.td}>{translateLocation(match.location, t)}</td>
                          <td style={previewStyles.td}>{formatMatchVenue(match, t)}</td>
                          <td style={previewStyles.td}>{[match.competition, match.matchday].filter(Boolean).join(" · ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {importPreview.duplicates.length > 0 && (
              <div>
                <h3 style={previewStyles.title}>{t("pages.matches.ignoredDuplicates")}</h3>
                <div style={previewStyles.duplicateGrid}>
                  {importPreview.duplicates.slice(0, 8).map((match) => (
                    <span key={getMatchIdentity(match)} style={previewStyles.duplicatePill}>
                      {formatDate(match.date)} · {match.time || "--:--"} · {match.opponent}
                    </span>
                  ))}
                  {importPreview.duplicates.length > 8 && (
                    <span style={previewStyles.duplicatePill}>+{importPreview.duplicates.length - 8} {t("pages.matches.moreItems")}</span>
                  )}
                </div>
              </div>
            )}

            <div style={previewStyles.actions}>
              <Button variant="ghost" onClick={() => setImportPreview(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmCalendarImport} disabled={importPreview.newMatches.length === 0}>
                {t("pages.matches.confirmImport")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PreviewStat({ label, value, tone = "#e2e8f0" }) {
  return (
    <div style={previewStyles.stat}>
      <span style={previewStyles.statLabel}>{label}</span>
      <strong style={{ ...previewStyles.statValue, color: tone }}>{value}</strong>
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

function loadMatchDraft(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

function clearMatchDraft(id = "new") {
  try {
    localStorage.removeItem(`${MATCH_DRAFT_KEY}:${id}`);
  } catch {
    /* localStorage can be unavailable in restricted browsers */
  }
}

function matchToForm(match) {
  const parsed = parseMatchResult(match.result);
  return {
    opponent: match.opponent || "",
    date: match.date || new Date().toISOString().slice(0, 10),
    time: match.time || "",
    location: match.location || "Casa",
    result: match.result || "",
    goalsFor:     parsed ? String(parsed.goalsFor)     : "",
    goalsAgainst: parsed ? String(parsed.goalsAgainst) : "",
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
  };
}

function emptyMatch(homeLogo = "") {
  return {
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    location: "Casa",
    result: "",
    goalsFor: "",
    goalsAgainst: "",
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

function getMatchStatus(match) {
  const result = String(match.result || "").trim();
  if (!result) return "In programma";

  const score = result.match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!score) return "In programma";

  const homeGoals = Number(score[1]);
  const awayGoals = Number(score[2]);
  if (homeGoals > awayGoals) return "Vinta";
  if (homeGoals < awayGoals) return "Persa";
  return "Pareggio";
}

function formatMatchVenue(match, t) {
  return [
    t ? translateLocation(match.location, t) : match.location,
    match.venueName,
    match.venueAddress,
  ].filter(Boolean).join(" · ") || "-";
}

const matchStyles = {
  inputError: { border: "1px solid #f87171", boxShadow: "0 0 0 2px rgba(248,113,113,0.15)" },
  errorMsg:   { display: "block", marginTop: 4, fontSize: 11, fontWeight: 700, color: "#f87171" },
};

const previewStyles = {
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 10,
  },
  stat: {
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.08)",
    minWidth: 0,
  },
  statLabel: {
    display: "block",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 6,
  },
  statValue: {
    display: "block",
    fontSize: 18,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  title: {
    margin: "0 0 10px",
    fontSize: 16,
    lineHeight: 1.2,
  },
  muted: {
    color: "#94a3b8",
    margin: 0,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 720,
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    background: "rgba(255,255,255,0.055)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  td: {
    padding: "10px 12px",
    color: "#e2e8f0",
    fontSize: 13,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top",
  },
  duplicateGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  duplicatePill: {
    borderRadius: 999,
    padding: "7px 10px",
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.22)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
};

export default Matches;
