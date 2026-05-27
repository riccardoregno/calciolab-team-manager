/**
 * NotFound.jsx — pagina 404
 * Mostrata per qualsiasi route non riconosciuta dall'app.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={s.root}>
      {/* Navbar minima */}
      <header style={s.nav}>
        <button style={s.logoBtn} onClick={() => navigate("/")}>
          <div style={s.logoBolt}>⚡</div>
          <span style={s.logoText}>CalcioLab</span>
        </button>
      </header>

      <main style={s.main}>
        <div style={s.glow} />
        <div style={s.card}>
          {/* Campo da calcio SVG stilizzato */}
          <div style={s.field}>
            <div style={s.fieldLine} />
            <div style={s.fieldCircle} />
            <div style={s.ball}>⚽</div>
          </div>

          <p style={s.code}>404</p>
          <h1 style={s.title}>{t("pages.notFound.title")}</h1>
          <p style={s.subtitle}>{t("pages.notFound.subtitle")}</p>

          <div style={s.actions}>
            <button style={s.btnPrimary} onClick={() => navigate("/")}>
              {t("pages.notFound.goHome")}
            </button>
            <button style={s.btnGhost} onClick={() => navigate(-1)}>
              {t("pages.notFound.goBack")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "#080b12",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  nav: {
    padding: "0 24px",
    height: 60,
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoBtn: {
    display: "flex", alignItems: "center", gap: 10,
    background: "none", border: "none", cursor: "pointer", padding: 0,
  },
  logoBolt: {
    width: 30, height: 30,
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    borderRadius: 8, display: "grid", placeItems: "center", fontSize: 14,
  },
  logoText: { fontWeight: 900, fontSize: 16, color: "white" },

  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    textAlign: "center",
    maxWidth: 440,
    width: "100%",
    position: "relative",
    zIndex: 1,
  },

  /* Campo da calcio */
  field: {
    width: 120,
    height: 80,
    margin: "0 auto 32px",
    background: "rgba(34,197,94,0.08)",
    border: "2px solid rgba(34,197,94,0.25)",
    borderRadius: 10,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    background: "rgba(34,197,94,0.2)",
    transform: "translateY(-50%)",
  },
  fieldCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  ball: {
    position: "absolute",
    top: -18,
    right: -12,
    fontSize: 32,
    transform: "rotate(-15deg)",
  },

  code: {
    fontSize: 96,
    fontWeight: 900,
    margin: "0 0 8px",
    lineHeight: 1,
    background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: -4,
  },
  title: {
    fontSize: 26,
    fontWeight: 900,
    margin: "0 0 12px",
    color: "white",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.65,
    margin: "0 0 36px",
    maxWidth: 360,
    marginLeft: "auto",
    marginRight: "auto",
  },
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    border: "none",
    color: "white",
    borderRadius: 12,
    padding: "12px 28px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(37,99,235,0.35)",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#64748b",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
};
