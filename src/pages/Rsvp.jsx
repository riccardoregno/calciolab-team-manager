import { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import AppCard from "../components/ui/AppCard";
import { useTranslation } from "../i18n";
import { getRsvpPayload, submitRsvpResponse } from "../services/rsvp";

function formatPublicMatch(match = {}) {
  const pieces = [];
  if (match.date) {
    pieces.push(new Date(match.date).toLocaleDateString(undefined, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }));
  }
  if (match.time) pieces.push(match.time);
  if (match.location) pieces.push(match.location);
  return pieces.filter(Boolean).join(" · ");
}

export default function Rsvp() {
  const { t } = useTranslation();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("t") || "";
  }, []);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState("");
  const [error, setError] = useState(() => token ? "" : t("pages.rsvp.missingToken"));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const { data, error: loadError } = await getRsvpPayload(token);
      if (!active) return;
      if (loadError) {
        setError(loadError.message);
      } else {
        setPayload(data);
      }
      setLoading(false);
    }

    if (!token) return undefined;

    load();
    return () => { active = false; };
  }, [token, t]);

  async function respond(response) {
    setSubmitting(response);
    setError("");
    const { data, error: submitError } = await submitRsvpResponse({ token, response });
    if (submitError) {
      setError(submitError.message);
    } else {
      setPayload(data);
      setSaved(true);
    }
    setSubmitting("");
  }

  const matchTitle = payload?.match?.opponent
    ? t("pages.rsvp.matchVs", { opponent: payload.match.opponent })
    : t("pages.rsvp.match");

  return (
    <div style={s.page}>
      <AppCard style={s.card}>
        <div style={s.kicker}>{t("pages.rsvp.kicker")}</div>
        <h1 style={s.title}>{t("pages.rsvp.title")}</h1>

        {loading ? (
          <p style={s.muted}>{t("common.loadingData")}</p>
        ) : error ? (
          <div style={s.errorBox}>
            <strong>{t("pages.rsvp.errorTitle")}</strong>
            <p>{error}</p>
          </div>
        ) : payload ? (
          <div style={s.content}>
            <div style={s.playerBox}>
              <span style={s.label}>{t("pages.rsvp.player")}</span>
              <strong>{payload.playerName}</strong>
            </div>

            <div style={s.details}>
              <span>{payload.teamName}</span>
              <strong>{matchTitle}</strong>
              <span>{formatPublicMatch(payload.match)}</span>
            </div>

            {saved && (
              <div style={s.saved}>
                {t("pages.rsvp.saved", {
                  response: payload.response === "yes" ? t("pages.rsvp.yes") : t("pages.rsvp.no"),
                })}
              </div>
            )}

            <div style={s.actions}>
              <Button
                onClick={() => respond("yes")}
                disabled={Boolean(submitting)}
                style={s.primaryAction}
              >
                {submitting === "yes" ? t("pages.rsvp.saving") : t("pages.rsvp.yes")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => respond("no")}
                disabled={Boolean(submitting)}
                style={s.secondaryAction}
              >
                {submitting === "no" ? t("pages.rsvp.saving") : t("pages.rsvp.no")}
              </Button>
            </div>
          </div>
        ) : null}
      </AppCard>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "radial-gradient(circle at top, rgba(59,130,246,0.18), transparent 34%), #0f1115",
    color: "#f8fafc",
  },
  card: {
    width: "min(100%, 520px)",
    padding: 28,
    borderRadius: 18,
  },
  kicker: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 18px",
    fontSize: "clamp(28px, 8vw, 44px)",
    lineHeight: 1,
    letterSpacing: 0,
  },
  muted: {
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  content: {
    display: "grid",
    gap: 18,
  },
  playerBox: {
    display: "grid",
    gap: 5,
    padding: 16,
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.24)",
  },
  label: {
    color: "#94a3b8",
    fontSize: 13,
  },
  details: {
    display: "grid",
    gap: 6,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  actions: {
    display: "grid",
    gap: 12,
    marginTop: 4,
  },
  primaryAction: {
    minHeight: 58,
    fontSize: 18,
  },
  secondaryAction: {
    minHeight: 58,
    fontSize: 18,
  },
  saved: {
    padding: "12px 14px",
    borderRadius: 14,
    color: "#86efac",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.28)",
    fontWeight: 800,
  },
  errorBox: {
    padding: 16,
    borderRadius: 14,
    color: "#fecaca",
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    lineHeight: 1.6,
  },
};
