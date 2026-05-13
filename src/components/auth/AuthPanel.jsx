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

export default function AuthPanel({
  authConfigured,
  authLoading,
  user,
  team,
  authError,
}) {
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
        ? "Accesso completato."
        : "Account creato. Controlla l'email se Supabase richiede conferma."
    );
  }

  if (!authConfigured) {
    return (
      <AppCard>
        <h3 style={styles.cardTitle}>Workspace cloud</h3>
        <p style={panelStyles.text}>
          Configura `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` per attivare
          login, team workspace e sincronizzazione cloud.
        </p>
        <Badge tone="orange">Demo locale</Badge>
      </AppCard>
    );
  }

  if (user) {
    return (
      <AppCard>
        <div style={panelStyles.header}>
          <div>
            <h3 style={styles.cardTitle}>Workspace cloud</h3>
            <p style={panelStyles.text}>{user.email}</p>
          </div>
          <Badge tone="green">Connesso</Badge>
        </div>

        <div style={panelStyles.grid}>
          <Info label="Team" value={team?.name || "Inizializzazione"} />
          <Info label="Stagione" value={team?.season || "-"} />
          <Info label="Ruolo" value={team?.role || "member"} />
        </div>

        {authError && <p style={panelStyles.error}>{authError}</p>}

        <Button variant="ghost" onClick={signOut} disabled={authLoading}>
          Esci dal workspace
        </Button>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <div style={panelStyles.header}>
        <div>
          <h3 style={styles.cardTitle}>Workspace cloud</h3>
          <p style={panelStyles.text}>
            Accedi per sincronizzare rosa, sedute, partite e statistiche sul tuo
            team Supabase.
          </p>
        </div>
        <Badge tone="blue">Supabase</Badge>
      </div>

      <form onSubmit={handleSubmit} style={panelStyles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={styles.input}
          required
        />
        <input
          type="password"
          placeholder="Password"
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
            {mode === "signin" ? "Accedi" : "Crea account"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Registrati" : "Ho gia un account"}
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

