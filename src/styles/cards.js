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
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 22,
    color: theme.colors.text,
    boxShadow: theme.shadow.card,
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
    marginBottom: 18,
    gap: 16,
    flexWrap: "wrap",
  },

  cardHeaderTitle: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.015em",
  },

cardHeaderSubtitle: {
  margin: "6px 0 0 0",
  color: theme.colors.muted,
  fontSize: 14,
  lineHeight: 1.45,
},
cardHover: {
  transition: "all 0.25s ease",
},
};
