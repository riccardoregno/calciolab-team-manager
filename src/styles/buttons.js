import { theme } from "./theme";

export const buttons = {
  primaryButton: {
    background: theme.colors.primary,
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: theme.radius.md,
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryButton: {
    background: "#1e2430",
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    padding: "12px 18px",
    borderRadius: theme.radius.md,
    fontWeight: 700,
    cursor: "pointer",
  },

  deleteButton: {
    background: theme.colors.dangerBg,
    color: theme.colors.dangerText,
    border: "none",
    padding: "12px 18px",
    borderRadius: theme.radius.md,
    fontWeight: 700,
    cursor: "pointer",
  },
};