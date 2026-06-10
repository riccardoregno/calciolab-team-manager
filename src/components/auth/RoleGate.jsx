import { useNavigate } from "react-router-dom";

import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { getCurrentUserRole, isRoleAllowed, memberRoles } from "../../utils/helpers";

// FIX #5: supabaseRole (da team_members.role su Supabase) è la fonte di verità.
// authConfigured=true → blocca il fallback su localStorage quando Supabase è attivo:
//   - supabaseRole presente → ok, usalo
//   - supabaseRole null con Supabase attivo → accesso negato (no fallback localStorage)
//   - supabaseRole null senza Supabase (locale) → fallback a appSettings accettabile
//
// customAreas support (featureKey + member props):
//   Se featureKey è fornito e member.customAreas[featureKey] è "view" o "manage",
//   l'accesso è garantito indipendentemente dal ruolo — permette override per-area
//   configurati dall'owner nell'invito (e modificabili in Settings).
export default function RoleGate({ allowedRoles = [], appSettings = {}, supabaseRole = null, authConfigured = false, member = null, featureKey = null, children }) {
  const navigate = useNavigate();

  // Controlla override customAreas PRIMA della verifica ruolo
  if (featureKey && member?.customAreas) {
    const areaAccess = member.customAreas[featureKey];
    if (areaAccess === "view" || areaAccess === "manage") {
      return children;
    }
  }

  const currentRole = authConfigured
    ? (supabaseRole ?? "")                         // Supabase attivo: usa solo il ruolo Supabase
    : (supabaseRole || getCurrentUserRole(appSettings)); // locale: fallback accettabile

  if (isRoleAllowed(currentRole, allowedRoles)) {
    return children;
  }

  return (
    <div style={gateStyles.page}>
      <AppCard>
        <div style={gateStyles.panel}>
          <div style={gateStyles.icon}>!</div>
          <Badge tone="orange">Accesso ruolo</Badge>
          <h1 style={gateStyles.title}>Vista non disponibile</h1>
          <p style={gateStyles.text}>
            Questa sezione non e' prevista per il ruolo <strong>{memberRoles[currentRole]?.label || currentRole}</strong>.
          </p>
          <p style={gateStyles.note}>
            Ruoli abilitati: {allowedRoles.map((role) => memberRoles[role]?.label || role).join(", ")}.
          </p>
          <div style={gateStyles.actions}>
            <Button onClick={() => navigate("/")}>Torna alla dashboard</Button>
            <Button variant="ghost" onClick={() => navigate("/settings")}>Impostazioni</Button>
          </div>
        </div>
      </AppCard>
    </div>
  );
}

const gateStyles = {
  page: {
    minHeight: "58vh",
    display: "grid",
    alignItems: "center",
  },
  panel: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: 14,
    padding: "28px 18px",
  },
  icon: {
    width: 74,
    height: 74,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    fontSize: 34,
    fontWeight: 950,
    color: "#facc15",
    background: "rgba(251,191,36,0.14)",
    border: "1px solid rgba(251,191,36,0.28)",
  },
  title: {
    margin: 0,
    fontSize: 34,
  },
  text: {
    margin: 0,
    color: "#cbd5e1",
    maxWidth: 620,
    lineHeight: 1.6,
  },
  note: {
    margin: 0,
    color: "#94a3b8",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 8,
  },
};
