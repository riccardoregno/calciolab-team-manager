import { useState } from "react";
import Button from "../ui/Button";
import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import {
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "../../services/auth";
import { styles } from "../../styles/index.js";
import { useTranslation } from "../../i18n";

export default function AuthPanel({
  authConfigured,
  authLoading,
  user,
  team,
  authError,
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setSubmitMessage("");

    const result =
      mode === "signin"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error.message);
      return;
    }

    setSubmitMessage(
      mode === "signin"
        ? t("components.authPanel.loginComplete")
        : t("components.authPanel.accountCreated")
    );
  }

  if (!authConfigured) {
    return (
      <AppCard>
        <h3 style={styles.cardTitle}>{t("components.authPanel.cloudWorkspace")}</h3>
        <p style={panelStyles.text}>
          {t("components.authPanel.configureSupabase")}
        </p>
        <Badge tone="orange">{t("components.authPanel.localDemo")}</Badge>
      </AppCard>
    );
  }

  if (user) {
    return (
      <AppCard>
        <div style={panelStyles.header}>
          <div>
            <h3 style={styles.cardTitle}>{t("components.authPanel.cloudWorkspace")}</h3>
            <p style={panelStyles.text}>{user.email}</p>
          </div>
          <Badge tone="green">{t("components.authPanel.connected")}</Badge>
        </div>

        <div style={panelStyles.grid}>
          <Info label={t("components.authPanel.team")} value={team?.name || t("components.authPanel.initialization")} />
          <Info label={t("components.authPanel.season")} value={team?.season || "-"} />
          <Info label={t("components.authPanel.role")} value={team?.role || "member"} />
        </div>

        {authError && <p style={panelStyles.error}>{authError}</p>}

        <Button variant="ghost" onClick={signOut} disabled={authLoading}>
          {t("components.authPanel.signOut")}
        </Button>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <div style={panelStyles.header}>
        <div>
          <h3 style={styles.cardTitle}>{t("components.authPanel.cloudWorkspace")}</h3>
          <p style={panelStyles.text}>
            {t("components.authPanel.syncSubtitle")}
          </p>
        </div>
        <Badge tone="blue">{t("components.authPanel.supabase")}</Badge>
      </div>

      <form onSubmit={handleSubmit} style={panelStyles.form}>
        <input
          type="email"
          placeholder={t("pages.auth.email")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={styles.input}
          required
        />
        <input
          type="password"
          placeholder={t("pages.auth.password")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={styles.input}
          minLength={6}
          required
        />

        {(submitError || authError) && (
          <p style={panelStyles.error}>{submitError || authError}</p>
        )}
        {submitMessage && <p style={panelStyles.success}>{submitMessage}</p>}

        <div style={panelStyles.actions}>
          <Button type="submit" disabled={submitting || authLoading}>
            {mode === "signin" ? t("components.authPanel.login") : t("components.authPanel.createAccount")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t("components.authPanel.createAccount") : t("components.authPanel.alreadyHaveAccount")}
          </Button>
        </div>
      </form>
    </AppCard>
  );
}

function Info({ label, value }) {
  return (
    <div style={panelStyles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const panelStyles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },
  text: {
    color: "#94a3b8",
    lineHeight: 1.5,
    margin: "6px 0 0",
  },
  form: {
    display: "grid",
    gap: 12,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 12,
    marginBottom: 16,
  },
  info: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
    fontSize: 12,
  },
  error: {
    color: "#fca5a5",
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
  },
  success: {
    color: "#86efac",
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
  },
};

