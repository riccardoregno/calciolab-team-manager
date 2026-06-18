import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import MetricStrip from "../components/ui/MetricStrip";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { useAreaPermission } from "../components/auth/permissionContext";
import { formatDate, normalizeAppSettings } from "../utils/helpers";
import { generateDistintaPDF } from "../utils/generateDistintaPDF";
import { generateMatchPackagePDF } from "../utils/generateMatchPackagePDF";
import { useTranslation } from "../i18n";
import { createRsvpLink, fetchMatchRsvps, sendMatchConvocationEmail } from "../services/rsvp";
import { useIsMobile } from "../hooks/useIsMobile";

const MAX_PLAYERS = 22;

const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
const ROLE_LABEL = {
  Portiere:       { short: "POR", tone: "orange" },
  Difensore:      { short: "DIF", tone: "blue" },
  Centrocampista: { short: "CEN", tone: "green" },
  Attaccante:     { short: "ATT", tone: "red" },
};

// Maps Italian DB role values → i18n keys for the print template group headers
const ROLE_I18N_KEY = {
  Portiere:       "pages.matchConvocation.rolePortiere",
  Difensore:      "pages.matchConvocation.roleDifensore",
  Centrocampista: "pages.matchConvocation.roleCentrocampista",
  Attaccante:     "pages.matchConvocation.roleAttaccante",
  Altro:          "pages.matchConvocation.roleAltro",
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

function getVenueParts(match = {}, profile = {}) {
  const isHomeMatch = match?.location === "Casa";
  return {
    name: String(match?.venueName || (isHomeMatch ? profile.homeFieldName : "") || "").trim(),
    address: String(match?.venueAddress || (isHomeMatch ? profile.homeFieldAddress : "") || "").trim(),
    surface: String(isHomeMatch ? profile.homeFieldSurface || "" : "").trim(),
  };
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

function buildConvocationText({ clubName, match, details, meetingInfo, sheetVenue, notes, convocati, t }) {
  const matchContext = [match.competition, match.matchday].filter(Boolean).join(" · ");
  const opponent = match.opponent || t("pages.matchConvocation.defaultOpponent");
  const lines = [
    t("pages.matchConvocation.convTextTitle", { club: clubName, opponent }),
    matchContext ? t("pages.matchConvocation.convTextCompetition", { value: matchContext }) : "",
    t("pages.matchConvocation.convTextDate", { value: formatDate(match.date) }),
    match.location ? t("pages.matchConvocation.convTextLocation", { value: match.location }) : "",
    details.matchTime ? t("pages.matchConvocation.convTextMatchTime", { value: details.matchTime }) : "",
    meetingInfo ? t("pages.matchConvocation.convTextMeeting", { value: meetingInfo }) : "",
    sheetVenue ? t("pages.matchConvocation.convTextField", { value: sheetVenue }) : "",
    details.lockerRoom ? t("pages.matchConvocation.convTextLockerRoom", { value: details.lockerRoom }) : "",
    details.kit ? t("pages.matchConvocation.convTextKit", { value: details.kit }) : "",
    details.staffContact ? t("pages.matchConvocation.convTextStaffContact", { value: details.staffContact }) : "",
    "",
    t("pages.matchConvocation.convTextRosterHeader"),
    ...convocati.map((player, index) => {
      const shirt = player.shirtNumber ? ` #${player.shirtNumber}` : "";
      return `${index + 1}. ${getPlayerDisplayName(player)}${shirt}`;
    }),
    details.message ? `\n${t("pages.matchConvocation.convTextMessage", { value: details.message })}` : "",
    notes ? t("pages.matchConvocation.convTextNotes", { value: notes }) : "",
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

export default function MatchConvocation({ teamId, players = [], matches = [], setMatches, appSettings = {} }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();

  const match = matches.find((m) => String(m.id) === String(id));
  const existing = match?.convocazione || {};
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const homeVenue = getHomeVenue(workspaceProfile);
  const matchVenue = getMatchVenue(match, homeVenue);
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const clubLogo = workspaceProfile.logo || "";
  const clubLogoSize = Number(workspaceProfile.logoSize || 100);
  const isHomeMatch = match?.location === "Casa";
  const venueParts = getVenueParts(match, workspaceProfile);
  const defaultNotes = matchVenue
    ? t("pages.matchConvocation.defaultNotesTemplate", { venue: matchVenue })
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
  const [rsvps, setRsvps] = useState([]);
  const [rsvpError, setRsvpError] = useState("");
  const [copyingRsvpId, setCopyingRsvpId] = useState("");
  const [sendingConvocations, setSendingConvocations] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

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

  useEffect(() => {
    let active = true;

    async function loadRsvps() {
      if (!teamId || !id) return;
      const { rsvps: rows, error } = await fetchMatchRsvps({ teamId, matchId: id });
      if (!active) return;
      setRsvps(rows);
      setRsvpError(error?.message || "");
    }

    loadRsvps();
    return () => { active = false; };
  }, [teamId, id]);

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>{t("pages.matchConvocation.notFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>
            {t("pages.matchConvocation.backToMatches")}
          </Button>
        </AppCard>
      </div>
    );
  }

  const groups = groupByRole(players);
  const count  = selectedIds.length;
  const full   = count >= MAX_PLAYERS;

  function toggle(pid) {
    if (!canManage) return;
    const key = String(pid);
    setSaved(false);
    setSelectedIds((prev) =>
      prev.includes(key)
        ? prev.filter((x) => x !== key)
        : full ? prev : [...prev, key]
    );
  }

  function selectAll() {
    if (!canManage) return;
    setSaved(false);
    setSelectedIds(players.slice(0, MAX_PLAYERS).map((p) => String(p.id)));
  }

  function clearAll() {
    if (!canManage) return;
    setSaved(false);
    setSelectedIds([]);
  }

  function updateDetails(field, value) {
    if (!canManage) return;
    setSaved(false);
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  function persistConvocazione(pub) {
    if (!canManage) return;
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

  function downloadDistinta() {
    const profile = normalizeAppSettings(appSettings).workspaceProfile;
    const staff   = normalizeAppSettings(appSettings).members || [];
    generateDistintaPDF(match, players, profile, staff);
  }

  function downloadMatchPackage() {
    const profile = normalizeAppSettings(appSettings).workspaceProfile;
    const staff   = normalizeAppSettings(appSettings).members || [];
    generateMatchPackagePDF({ match, allPlayers: players, profile, staffList: staff, appSettings });
  }

  async function copyConvocation(kind, text) {
    await copyText(text);
    setCopiedLabel(kind);
    window.setTimeout(() => setCopiedLabel(""), 1800);
  }

  async function copyRsvpLink(player) {
    if (!canManage) return;
    if (!teamId || !match?.id || !player?.id) return;

    const pid = String(player.id);
    setCopyingRsvpId(pid);
    setRsvpError("");
    const { link, error } = await createRsvpLink({
      teamId,
      matchId: String(match.id),
      playerId: pid,
    });

    if (error) {
      setRsvpError(error.message);
    } else {
      await copyText(link);
      setCopiedLabel(t("pages.matchConvocation.rsvpLinkCopied"));
      const { rsvps: rows } = await fetchMatchRsvps({ teamId, matchId: id });
      setRsvps(rows);
      window.setTimeout(() => setCopiedLabel(""), 1800);
    }

    setCopyingRsvpId("");
  }

  async function sendConvocations() {
    if (!canManage) return;
    if (!teamId || !match?.id || sendingConvocations) return;

    const targets = convocati.filter((p) => String(p.email || "").trim());
    const skipped = convocati.filter((p) => !String(p.email || "").trim());

    if (targets.length === 0) {
      setRsvpError(t("pages.matchConvocation.sendConvocationsNoEmails"));
      return;
    }

    setSendingConvocations(true);
    setRsvpError("");

    let sentCount = 0;
    const failed = [];

    try {
      for (const player of targets) {
        let link = "";
        try {
          const result = await createRsvpLink({
            teamId,
            matchId: String(match.id),
            playerId: String(player.id),
          });
          if (result.error) throw result.error;
          link = result.link;
        } catch {
          failed.push(getPlayerDisplayName(player));
          continue;
        }

        try {
          const { error: emailError } = await sendMatchConvocationEmail({
            teamId,
            to: player.email,
            playerName: getPlayerDisplayName(player),
            teamName: clubName,
            opponent: match.opponent || "",
            matchDate: formatDate(match.date),
            matchTime: match.time || "",
            matchVenue: matchVenue || match.location || "",
            rsvpUrl: link,
          });
          if (emailError) throw emailError;
          sentCount += 1;
        } catch {
          failed.push(getPlayerDisplayName(player));
        }
      }

      const { rsvps: rows } = await fetchMatchRsvps({ teamId, matchId: id });
      setRsvps(rows);
    } finally {
      const messages = [];
      if (sentCount > 0) {
        messages.push(t("pages.matchConvocation.sendConvocationsSuccess", { count: sentCount }));
      }
      if (skipped.length > 0) {
        messages.push(t("pages.matchConvocation.sendConvocationsSkipped", {
          count: skipped.length,
          names: skipped.map(getPlayerDisplayName).join(", "),
        }));
      }
      if (failed.length > 0) {
        messages.push(t("pages.matchConvocation.sendConvocationsFailed", { names: failed.join(", ") }));
      }
      setRsvpError(messages.join(" "));
      setCopiedLabel("");
      setSendingConvocations(false);
    }
  }

  function markAsSent(channel = "WhatsApp") {
    if (!canManage) return;
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
    match.time ? t("pages.matchConvocation.subtitleTimePrefix", { time: match.time }) : null,
    matchVenue || match.location,
    match.result || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const convocati = selectedIds
    .map((pid) => players.find((p) => String(p.id) === pid))
    .filter(Boolean);
  const rsvpMap = new Map(rsvps.map((rsvp) => [String(rsvp.player_id), rsvp]));
  const emailTargets = convocati.filter((p) => String(p.email || "").trim());
  const emailMissing = convocati.filter((p) => !String(p.email || "").trim());
  const rsvpStats = convocati.reduce((acc, player) => {
    const response = rsvpMap.get(String(player.id))?.response || "pending";
    acc[response] = (acc[response] || 0) + 1;
    return acc;
  }, { yes: 0, no: 0, pending: 0 });

  const rsvpTotal = convocati.length;
  const rsvpResponded = (rsvpStats.yes || 0) + (rsvpStats.no || 0);
  const rsvpResponsePct = rsvpTotal > 0 ? Math.round((rsvpResponded / rsvpTotal) * 100) : 0;
  const rsvpAvgHours = (() => {
    const times = rsvps
      .filter((r) => r.response && r.responded_at && r.created_at)
      .map((r) => (new Date(r.responded_at) - new Date(r.created_at)) / 3600000)
      .filter((v) => Number.isFinite(v) && v >= 0);
    if (!times.length) return null;
    return Math.round(times.reduce((s, v) => s + v, 0) / times.length);
  })();
  const convocatiByRole = groupByRole(convocati);
  const selectedRoleCounts = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = convocati.filter((player) => player.role === role).length;
    return acc;
  }, {});
  const sheetVenue = matchVenue || match.location;
  const meetingInfo = formatMeeting(details);
  const matchContext = [match.competition, match.matchday].filter(Boolean).join(" · ");
  const matchType = match.location || t("pages.matchConvocation.printToBeDefined");
  const publishedLabel = published ? t("pages.matchConvocation.publishedLabel") : t("pages.matchConvocation.draftLabel");
  const fullMessage = buildConvocationText({
    clubName,
    match,
    details,
    meetingInfo,
    sheetVenue,
    notes,
    convocati,
    t,
  });
  const rosterMessage = buildConvocationRosterText(convocati);

  return (
    <div style={s.page}>
      <PageHeader
        title={`${t("pages.matchConvocation.title")} — ${match.opponent || t("pages.matchConvocation.defaultOpponent")}`}
        subtitle={subtitle}
        badge={publishedLabel}
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
            <span style={s.countOf}>{t("pages.matchConvocation.counterOf", { max: MAX_PLAYERS })}</span>
            {published && (
              <Badge tone="green" style={{ marginLeft: 8 }}>{t("pages.matchConvocation.badgePublished")}</Badge>
            )}
            {count > 0 && (
              <Badge tone="blue" style={{ marginLeft: 8 }}>
                {t("pages.matchConvocation.rsvpSummary", {
                  yes: rsvpStats.yes || 0,
                  no: rsvpStats.no || 0,
                  pending: rsvpStats.pending || 0,
                })}
              </Badge>
            )}
            {!published && count > 0 && (
              <Badge tone="orange" style={{ marginLeft: 8 }}>{t("pages.matchConvocation.draftLabel")}</Badge>
            )}
          </div>

          <div style={s.topActions}>
            {canManage && (
              <>
                <Button variant="ghost" onClick={clearAll}>{t("pages.matchConvocation.clearAll")}</Button>
                <Button variant="ghost" onClick={selectAll}>{t("common.selectAll")}</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => navigate("/matches")}>{t("common.back")}</Button>
            <Button variant="ghost" onClick={downloadDistinta} title="Scarica distinta FIGC in PDF">
              📄 {t("pages.matchConvocation.downloadDistinta")}
            </Button>
            <Button variant="ghost" onClick={downloadMatchPackage} title={t("pages.matchConvocation.downloadPackage")}>
              🗂️ {t("pages.matchConvocation.downloadPackage")}
            </Button>
            {canManage && (
              <>
                <Button variant="ghost" onClick={() => persistConvocazione(false)} disabled={count === 0}>
                  {t("pages.matchConvocation.saveDraft")}
                </Button>
                <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
                  {published ? t("pages.matchConvocation.updatePublication") : t("pages.matchConvocation.publishConvocation")}
                </Button>
              </>
            )}
          </div>
        </div>

        {saved && (
          <p style={s.savedMsg}>
            {published ? t("pages.matchConvocation.savedPublished") : t("pages.matchConvocation.savedDraft")}
          </p>
        )}
        {published && (
          <div style={s.portalRow}>
            <span style={s.portalMsg}>{t("pages.matchConvocation.portalVisible")}</span>
            <Button variant="ghost" onClick={() => navigate("/player-portal")}>
              {t("pages.matchConvocation.openPortal")}
            </Button>
          </div>
        )}
      </AppCard>

      {/* ── Dettagli professionali convocazione ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 10px", lineHeight: 1.2 }}>{t("pages.matchConvocation.detailsTitle")}</h3>
        <p style={s.muted}>
          {t("pages.matchConvocation.detailsSubtitle")}
        </p>
        <div style={s.matchInfoGrid}>
          <InfoTile label={t("pages.matchConvocation.tileMatch")} value={matchType} />
          <InfoTile label={t("pages.matchConvocation.tileCompetition")} value={matchContext || t("pages.matchConvocation.printToBeDefined")} />
          <InfoTile label={t("pages.matchConvocation.printField")} value={venueParts.name || sheetVenue || t("pages.matchConvocation.printToBeDefined")} />
          <InfoTile label={t("pages.matchConvocation.tileAddress")} value={venueParts.address || t("pages.matchConvocation.printToBeDefined")} />
          <InfoTile label={t("pages.matchConvocation.printSurface")} value={venueParts.surface || t("pages.matchConvocation.printToBeDefined")} />
        </div>
        <div style={s.formGrid}>
          <label style={s.label}>
            {t("pages.matchConvocation.fieldMatchTime")}
            <input
              type="time"
              value={details.matchTime}
              onChange={(e) => updateDetails("matchTime", e.target.value)}
              disabled={!canManage}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            {t("pages.matchConvocation.fieldMeetingTime")}
            <input
              type="time"
              value={details.meetingTime}
              onChange={(e) => updateDetails("meetingTime", e.target.value)}
              disabled={!canManage}
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            {t("pages.matchConvocation.fieldMeetingPlace")}
            <input
              value={details.meetingPlace}
              onChange={(e) => updateDetails("meetingPlace", e.target.value)}
              disabled={!canManage}
              placeholder={matchVenue || homeVenue || t("pages.matchConvocation.meetingPlacePlaceholder")}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            {t("pages.matchConvocation.printLockerRoom")}
            <input
              value={details.lockerRoom}
              onChange={(e) => updateDetails("lockerRoom", e.target.value)}
              disabled={!canManage}
              placeholder={t("pages.matchConvocation.lockerRoomPlaceholder")}
              style={s.input}
            />
          </label>
          <label style={s.label}>
            {t("pages.matchConvocation.fieldKit")}
            <input
              value={details.kit}
              onChange={(e) => updateDetails("kit", e.target.value)}
              disabled={!canManage}
              placeholder={t("pages.matchConvocation.kitPlaceholder")}
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            {t("pages.matchConvocation.printStaffContact")}
            <input
              value={details.staffContact}
              onChange={(e) => updateDetails("staffContact", e.target.value)}
              disabled={!canManage}
              placeholder={t("pages.matchConvocation.staffContactPlaceholder")}
              style={s.input}
            />
          </label>
          <label style={s.labelFull}>
            {t("pages.matchConvocation.fieldMessage")}
            <textarea
              style={s.textarea}
              rows={2}
              placeholder={t("pages.matchConvocation.messagePlaceholder")}
              value={details.message}
              onChange={(e) => updateDetails("message", e.target.value)}
              disabled={!canManage}
            />
          </label>
        </div>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder={defaultNotes || t("pages.matchConvocation.notesInternalPlaceholder")}
          value={notes}
          onChange={(e) => { if (!canManage) return; setNotes(e.target.value); setSaved(false); }}
          disabled={!canManage}
        />
      </AppCard>

      {/* ── Comunicazione staff / gruppo squadra ── */}
      <AppCard>
        <div style={s.communicationHeader}>
          <div>
            <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>{t("pages.matchConvocation.commTitle")}</h3>
            <p style={s.muted}>
              {t("pages.matchConvocation.commSubtitle")}
            </p>
          </div>
          <Badge tone={existing.sentAt ? "green" : "orange"}>
            {existing.sentAt
              ? (existing.sentChannel
                  ? t("pages.matchConvocation.sentBadgeWithChannel", { channel: existing.sentChannel })
                  : t("pages.matchConvocation.sentBadge"))
              : t("pages.matchConvocation.notSentBadge")}
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
            onClick={() => copyConvocation(t("pages.matchConvocation.copiedLabelMessage"), fullMessage)}
            disabled={count === 0}
          >
            {t("pages.matchConvocation.copyWhatsApp")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => copyConvocation(t("pages.matchConvocation.copiedLabelRoster"), rosterMessage)}
            disabled={count === 0}
          >
            {t("pages.matchConvocation.copyRoster")}
          </Button>
          {canManage && (
            <Button
              onClick={() => markAsSent("WhatsApp")}
              disabled={count === 0}
            >
              {t("pages.matchConvocation.markSent")}
            </Button>
          )}
        </div>

        <div style={s.communicationFooter}>
          {copiedLabel && <span style={s.copyOk}>{t("pages.matchConvocation.copiedFeedback", { label: copiedLabel })}</span>}
          {existing.sentAt && (
            <span style={s.sentInfo}>
              {t("pages.matchConvocation.lastSentDate", { date: formatDate(existing.sentAt) })}
            </span>
          )}
        </div>
      </AppCard>

      {/* ── Selezione giocatori ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 4px", lineHeight: 1.2 }}>{t("pages.matchConvocation.selectPlayersTitle")}</h3>
        <p style={s.muted}>
          {t("pages.matchConvocation.selectPlayersHint", { max: MAX_PLAYERS })}
          {full && <span style={{ color: "#f87171", marginLeft: 6 }}>{t("pages.matchConvocation.limitReached")}</span>}
        </p>

        <div style={s.groups}>
          {Object.entries(groups).map(([role, rolePlayers]) => {
            const meta = ROLE_LABEL[role] || { short: "?", tone: "blue" };
            return (
              <div key={role} style={s.roleGroup}>
                <div style={s.roleHeader}>
                  <Badge tone={meta.tone}>{meta.short}</Badge>
                  <span style={s.roleLabel}>{ROLE_I18N_KEY[role] ? t(ROLE_I18N_KEY[role]) : role}</span>
                  <span style={s.roleCount}>
                    {rolePlayers.filter((p) => selectedIds.includes(String(p.id))).length}/{rolePlayers.length}
                  </span>
                </div>

                <div style={{ ...s.playerGrid, gridTemplateColumns: isMobile ? "1fr" : s.playerGrid.gridTemplateColumns }}>
                  {rolePlayers.map((player) => {
                    const pid      = String(player.id);
                    const selected = selectedIds.includes(pid);
                    const disabled = !canManage || (!selected && full);
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

      {/* ── RSVP disponibilità ── */}
      {convocati.length > 0 && (
        <AppCard>
          <div style={{ ...s.communicationHeader, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: "0 0 6px", lineHeight: 1.2 }}>{t("pages.matchConvocation.rsvpTitle")}</h3>
              <p style={s.muted}>{t("pages.matchConvocation.rsvpSubtitle")}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="blue">
                {t("pages.matchConvocation.rsvpSummary", {
                  yes: rsvpStats.yes || 0,
                  no: rsvpStats.no || 0,
                  pending: rsvpStats.pending || 0,
                })}
              </Badge>
              {canManage && (
                <Button
                  onClick={() => setShowEmailPreview((value) => !value)}
                  disabled={sendingConvocations || !teamId}
                  style={{ flex: isMobile ? "1 1 100%" : "0 0 auto" }}
                >
                  {t("pages.matchConvocation.sendConvocationsButton")}
                </Button>
              )}
            </div>
          </div>

          {rsvpTotal > 0 && (
            <MetricStrip
              className="mobile-scroll-x"
              style={{ margin: "12px 0 4px" }}
              items={[
                { key: "pct",     label: t("pages.matchConvocation.kpiResponseRate"),    value: `${rsvpResponsePct}%`, color: rsvpResponsePct >= 80 ? "#22c55e" : rsvpResponsePct >= 50 ? "#fb923c" : "#f87171" },
                { key: "yes",     label: t("pages.matchConvocation.kpiYes"),             value: rsvpStats.yes || 0,    color: "#22c55e" },
                { key: "no",      label: t("pages.matchConvocation.kpiNo"),              value: rsvpStats.no || 0,     color: "#f87171" },
                { key: "pending", label: t("pages.matchConvocation.kpiPending"),         value: rsvpStats.pending || 0, color: rsvpStats.pending > 0 ? "#fb923c" : "#64748b" },
                rsvpAvgHours !== null
                  ? { key: "avg", label: t("pages.matchConvocation.kpiAvgTime"),        value: `${rsvpAvgHours}h`,    color: "#a78bfa" }
                  : null,
              ]}
            />
          )}

          {rsvpError && <p style={s.errorText}>{rsvpError}</p>}

          {showEmailPreview && (
            <div style={s.emailPreviewBox}>
              <div style={s.emailPreviewHeader}>
                <div>
                  <strong>{t("pages.matchConvocation.emailPreviewTitle")}</strong>
                  <p style={s.muted}>
                    {t("pages.matchConvocation.emailPreviewSubtitle", {
                      count: emailTargets.length,
                      missing: emailMissing.length,
                    })}
                  </p>
                </div>
                <Button
                  onClick={sendConvocations}
                  disabled={sendingConvocations || emailTargets.length === 0}
                >
                  {sendingConvocations
                    ? t("pages.matchConvocation.sendConvocationsSending")
                    : t("pages.matchConvocation.emailPreviewConfirm")}
                </Button>
              </div>
              <div style={s.emailPreviewGrid}>
                <div style={s.emailPreviewList}>
                  <span style={s.emailPreviewLabel}>{t("pages.matchConvocation.emailPreviewRecipients")}</span>
                  {emailTargets.length ? emailTargets.map((player) => (
                    <div key={player.id} style={s.emailPreviewRow}>
                      <strong>{getPlayerDisplayName(player)}</strong>
                      <span>{player.email}</span>
                    </div>
                  )) : (
                    <p style={s.muted}>{t("pages.matchConvocation.sendConvocationsNoEmails")}</p>
                  )}
                </div>
                <div style={s.emailPreviewList}>
                  <span style={s.emailPreviewLabel}>{t("pages.matchConvocation.emailPreviewMissing")}</span>
                  {emailMissing.length ? emailMissing.map((player) => (
                    <div key={player.id} style={s.emailPreviewRow}>
                      <strong>{getPlayerDisplayName(player)}</strong>
                      <span>{t("pages.matchConvocation.emailPreviewNoEmail")}</span>
                    </div>
                  )) : (
                    <p style={s.muted}>{t("pages.matchConvocation.emailPreviewNoneMissing")}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={s.rsvpList}>
            {convocati.map((player) => {
              const pid = String(player.id);
              const rsvp = rsvpMap.get(pid);
              const status = rsvp?.response || "pending";
              const displayName =
                [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                player.name || "—";

              return (
                <div key={pid} style={{ ...s.rsvpRow, alignItems: isMobile ? "stretch" : s.rsvpRow.alignItems }}>
                  <div style={{ ...s.rsvpPlayer, minWidth: isMobile ? 0 : s.rsvpPlayer.minWidth }}>
                    <span style={s.shirtNum}>{player.shirtNumber || "—"}</span>
                    <div>
                      <strong>{displayName}</strong>
                      {rsvp?.responded_at && (
                        <span style={s.rsvpDate}>{formatDate(rsvp.responded_at)}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ ...s.rsvpActions, width: isMobile ? "100%" : "auto" }}>
                    <Badge tone={status === "yes" ? "green" : status === "no" ? "red" : "orange"}>
                      {t(`pages.matchConvocation.rsvpStatus.${status}`)}
                    </Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        onClick={() => copyRsvpLink(player)}
                        disabled={copyingRsvpId === pid || !teamId}
                        style={{ flex: isMobile ? 1 : "0 0 auto" }}
                      >
                        {copyingRsvpId === pid
                          ? t("pages.matchConvocation.rsvpCopying")
                          : t("pages.matchConvocation.rsvpCopyLink")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AppCard>
      )}

      {/* ── Foglio convocazione ── */}
      {count > 0 && (
        <AppCard>
          <div style={s.sheetToolbar}>
            <h3 style={{ margin: 0, lineHeight: 1.2 }}>
              {t("pages.matchConvocation.printSheet")}
              {!published && <span style={{ ...s.muted, marginLeft: 8, fontSize: 13 }}>{t("pages.matchConvocation.sheetDraftNote")}</span>}
            </h3>
            <div style={s.sheetToolbarActions}>
              <Button variant="ghost" onClick={printConvocationSheet}>
                {t("pages.matchConvocation.printPdf")}
              </Button>
              {canManage && (
                <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
                  {published ? t("pages.matchConvocation.updatePublication") : t("pages.matchConvocation.publishNow")}
                </Button>
              )}
            </div>
          </div>

          <div className="print-area print-template" style={s.printSheet}>
            <article>
              <div className="print-header" style={s.printHeader}>
                <div style={s.printBrand}>
                  <TeamLogo logo={clubLogo} logoSize={clubLogoSize} name={clubName} />
                  <div>
                    <p>{t("pages.matchConvocation.printSheet")}</p>
                    <h1>
                      {clubName} <span style={{ color: "#64748b" }}>vs</span> {match.opponent || "Avversario"}
                    </h1>
                  </div>
                </div>
                <div className="print-meta">
                  {matchContext && <span>{matchContext}</span>}
                  <span>{formatDate(match.date)}</span>
                  {details.matchTime && <span>{t("pages.matchConvocation.printTimeLabel")} {details.matchTime}</span>}
                  <span>{matchType}</span>
                  <span>{publishedLabel}</span>
                  <span>{t("pages.matchConvocation.printCalledCount", { count })}</span>
                </div>
              </div>

              <section className="print-kpis">
                <PrintKpi label={t("pages.matchConvocation.printCalled")} value={`${count}/${MAX_PLAYERS}`} />
                <PrintKpi label={t("pages.matchConvocation.printGoalkeepers")} value={selectedRoleCounts.Portiere || 0} />
                <PrintKpi label={t("pages.matchConvocation.printDefenders")} value={selectedRoleCounts.Difensore || 0} />
                <PrintKpi label={t("pages.matchConvocation.printMidAttack")} value={(selectedRoleCounts.Centrocampista || 0) + (selectedRoleCounts.Attaccante || 0)} />
              </section>

              <section className="print-grid two">
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printMeeting")}</span>
                  <p>{meetingInfo || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printField")}</span>
                  <p>{sheetVenue || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printAddress")}</span>
                  <p>{venueParts.address || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printSurface")}</span>
                  <p>{venueParts.surface || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printLockerRoom")}</span>
                  <p>{details.lockerRoom || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printKit")}</span>
                  <p>{details.kit || t("pages.matchConvocation.printToBeDefined")}</p>
                </div>
              </section>

              {(details.staffContact || details.message || notes) && (
                <section className="print-grid two">
                  {details.staffContact && (
                    <div className="print-box">
                      <span>{t("pages.matchConvocation.printStaffContact")}</span>
                      <p>{details.staffContact}</p>
                    </div>
                  )}
                  {details.message && (
                    <div className="print-box">
                      <span>{t("pages.matchConvocation.printMessage")}</span>
                      <p>{details.message}</p>
                    </div>
                  )}
                  {notes && (
                    <div className="print-box">
                      <span>{t("pages.matchConvocation.printNotes")}</span>
                      <p>{notes}</p>
                    </div>
                  )}
                </section>
              )}

              <section className="print-section">
                <h2>{t("pages.matchConvocation.printRoster")}</h2>
                <div style={s.printRosterGroups}>
                  {Object.entries(convocatiByRole).map(([role, rolePlayers]) => (
                    <div key={role} style={s.printRosterGroup}>
                      <h3 style={s.printRoleTitle}>{ROLE_I18N_KEY[role] ? t(ROLE_I18N_KEY[role]) : role}</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>{t("pages.matchConvocation.printNumber")}</th>
                            <th>{t("pages.matchConvocation.printShirt")}</th>
                            <th>{t("pages.matchConvocation.printPlayer")}</th>
                            <th>{t("pages.matchConvocation.printStatus")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rolePlayers.map((player, index) => {
                            const displayName = getPlayerDisplayName(player);

                            return (
                              <tr key={player.id}>
                                <td>{index + 1}</td>
                                <td>#{player.shirtNumber || "—"}</td>
                                <td>{displayName}</td>
                                <td>{player.status || t("pages.matchConvocation.statusAvailable")}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </section>

              <section className="print-grid two">
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printStaffSignature")}</span>
                  <p style={s.signatureLine} />
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printPublishedAt")}</span>
                  <p>{published && existing.publishedAt ? formatDate(existing.publishedAt) : t("pages.matchConvocation.printToBePublished")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printPreMatchCheck")}</span>
                  <p>{t("pages.matchConvocation.printPreMatchCheckText")}</p>
                </div>
                <div className="print-box">
                  <span>{t("pages.matchConvocation.printLogisticsNotes")}</span>
                  <p>{details.staffContact ? t("pages.matchConvocation.printReferent", { value: details.staffContact }) : t("pages.matchConvocation.printReferentFallback")}</p>
                </div>
              </section>
            </article>
          </div>

          <div style={s.previewActions}>
            <Button variant="ghost" onClick={() => persistConvocazione(false)}>
              {t("pages.matchConvocation.saveDraft")}
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

function InfoTile({ label, value }) {
  return (
    <div style={s.infoTile}>
      <span style={s.infoTileLabel}>{label}</span>
      <strong style={s.infoTileValue}>{value}</strong>
    </div>
  );
}

function PrintKpi({ label, value }) {
  return (
    <div className="print-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
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
  matchInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  infoTile: {
    display: "grid",
    gap: 5,
    padding: "11px 13px",
    borderRadius: 12,
    background: "rgba(59,130,246,0.08)",
    border: "1px solid rgba(59,130,246,0.18)",
    color: "#e2e8f0",
  },
  infoTileLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  infoTileValue: { fontSize: 13, lineHeight: 1.25 },
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
  errorText: {
    margin: "10px 0 0",
    color: "#fecaca",
    fontSize: 13,
    fontWeight: 700,
  },
  emailPreviewBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.20)",
    background: "rgba(59,130,246,0.08)",
    display: "grid",
    gap: 12,
  },
  emailPreviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  emailPreviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
  },
  emailPreviewList: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.35)",
  },
  emailPreviewLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  emailPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#cbd5e1",
    fontSize: 13,
    flexWrap: "wrap",
  },
  rsvpList: {
    display: "grid",
    gap: 8,
    marginTop: 14,
  },
  rsvpRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    flexWrap: "wrap",
  },
  rsvpPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 180,
  },
  rsvpDate: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  rsvpActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

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
  printRosterGroups: {
    display: "grid",
    gap: 14,
  },
  printRosterGroup: {
    display: "grid",
    gap: 8,
  },
  printRoleTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
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
