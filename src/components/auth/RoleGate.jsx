import { useNavigate } from "react-router-dom";

import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import PermissionProvider from "./PermissionProvider";
import { getCurrentUserRole, isRoleAllowed, memberRoles } from "../../utils/helpers";
import { supabase } from "../../lib/supabaseClient";

// FIX #5: supabaseRole (da team_members.role su Supabase) è la fonte di verità.
// authConfigured=true → blocca il fallback su localStorage quando Supabase è attivo:
//   - supabaseRole presente → ok, usalo
//   - supabaseRole null con Supabase attivo → accesso negato (no fallback localStorage)
//   - supabaseRole null senza Supabase (locale) → fallback a appSettings accettabile
//
// customAreas support (featureKey + member props):
//   - "none" blocca l'area anche se il ruolo base la vedrebbe.
//   - "view" permette l'accesso in sola lettura.
//   - "manage" permette lettura + scrittura.
//   - "role"/undefined usa i permessi predefiniti del ruolo.
export default function RoleGate({ allowedRoles = [], appSettings = {}, supabaseRole = null, authConfigured = false, member = null, featureKey = null, children }) {
  const navigate = useNavigate();

  const currentRole = authConfigured
    ? (supabaseRole ?? "")                         // Supabase attivo: usa solo il ruolo Supabase
    : (supabaseRole || getCurrentUserRole(appSettings)); // locale: fallback accettabile

  const areaAccess = featureKey && member?.customAreas
    ? member.customAreas[featureKey]
    : null;

  if (areaAccess === "none") {
    return deniedView({
      currentRole,
      allowedRoles,
      navigate,
      title: "Area non disponibile",
      badge: "Accesso area",
      message: "Questa area e' stata disattivata per il tuo profilo.",
    });
  }

  if (areaAccess === "view" || areaAccess === "manage") {
    return wrapWithPermission(children, featureKey, areaAccess, "custom");
  }

  if (
    authConfigured &&
    featureKey &&
    !member &&
    currentRole &&
    !["owner", "headCoach"].includes(currentRole)
  ) {
    return wrapWithPermission(children, featureKey, "view", "pending-member");
  }

  if (isRoleAllowed(currentRole, allowedRoles)) {
    return wrapWithPermission(children, featureKey, "manage", "role");
  }

  return deniedView({
    currentRole,
    allowedRoles,
    navigate,
    title: "Vista non disponibile",
    badge: "Accesso ruolo",
    message: `Questa sezione non e' prevista per il ruolo ${memberRoles[currentRole]?.label || currentRole}.`,
    isPlayer: currentRole === "player",
  });
}

function wrapWithPermission(children, area, level, source) {
  return (
    <PermissionProvider
      value={{
        area,
        level,
        source,
        canView: level === "view" || level === "manage",
        canManage: level === "manage",
      }}
    >
      {children}
    </PermissionProvider>
  );
}

function deniedView({ allowedRoles, navigate, title, badge, message, isPlayer }) {
  return (
    <div style={gateStyles.page}>
      <AppCard>
        <div style={gateStyles.panel}>
          <div style={gateStyles.icon}>!</div>
          <Badge tone="orange">{badge}</Badge>
          <h1 style={gateStyles.title}>{title}</h1>
          <p style={gateStyles.text}>{message}</p>
          {!isPlayer && (
            <p style={gateStyles.note}>
              Ruoli abilitati: {allowedRoles.map((role) => memberRoles[role]?.label || role).join(", ")}.
            </p>
          )}
          <div style={gateStyles.actions}>
            {isPlayer ? (
              <>
                <Button onClick={() => navigate("/player-portal")}>Vai al portale giocatore</Button>
                <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>Esci</Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate("/")}>Torna alla dashboard</Button>
                <Button variant="ghost" onClick={() => navigate("/settings")}>Impostazioni</Button>
              </>
            )}
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
