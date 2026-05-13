import { theme } from "./theme";

export const calendar = {
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: 20,
    alignItems: "start",
  },

  dayBlock: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: 20,
  },

  calendarEvent: {
    width: "100%",
    textAlign: "left",
    background: "#111827",
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: 14,
    display: "grid",
    gap: 6,
    cursor: "pointer",
  },

  attendanceRow: {
    background: "#111827",
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: 14,
    display: "grid",
    gap: 12,
  },
};