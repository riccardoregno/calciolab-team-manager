import { theme } from "./theme";

export const cards = {
  card: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 22,
    color: theme.colors.text,
    boxShadow: theme.shadow.card,
  },

 sectionCard: {
  background: "linear-gradient(180deg, #171b24 0%, #11151d 100%)",
  border: "1px solid #2b3240",
  borderRadius: 18,
  padding: 22,
  color: theme.colors.text,
  boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  backdropFilter: "blur(10px)",
},

  playerCard: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 20,
    color: theme.colors.text,
  },
    statusBadge: (status) => ({
    background:
      status === "Disponibile"
        ? "#123d2a"
        : status === "Infortunato"
        ? "#4a1f1f"
        : status === "Recupero"
        ? "#3b2f12"
        : "#1e293b",

    color:
      status === "Disponibile"
        ? "#86efac"
        : status === "Infortunato"
        ? "#fca5a5"
        : status === "Recupero"
        ? "#fde68a"
        : "#cbd5e1",

    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
  }),
    intensityBadge: (intensity) => ({
    background:
      intensity === "Alta"
        ? "#4a1f1f"
        : intensity === "Media"
        ? "#3b2f12"
        : "#123d2a",

    color:
      intensity === "Alta"
        ? "#fca5a5"
        : intensity === "Media"
        ? "#fde68a"
        : "#86efac",

    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
  }),
  cardHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 20,
  gap: 16,
  flexWrap: "wrap",
},

cardHeaderTitle: {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 850,
},

cardHeaderSubtitle: {
  margin: "6px 0 0 0",
  color: "#9ca3af",
  fontSize: 14,
  lineHeight: 1.45,
},
cardHover: {
  transition: "all 0.25s ease",
},
};
