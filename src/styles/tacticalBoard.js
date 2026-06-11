export const boardStyles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 330px",
    gap: 18,
    alignItems: "start",
  },

  mainColumn: {
    minWidth: 0,
  },

  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.4,
  },

  title: {
    margin: "4px 0 0",
    color: "#f8fafc",
    fontSize: 28,
    letterSpacing: -0.8,
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 13,
  },

  counters: {
    display: "flex",
    gap: 10,
  },

  counterBlue: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(37,99,235,0.16)",
    border: "1px solid rgba(96,165,250,0.28)",
    color: "#bfdbfe",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 78,
  },

  counterRed: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(239,68,68,0.13)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#fecaca",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 78,
  },

  playerTooltip: {
  position: "absolute",
  left: "50%",
  top: 42,
  transform: "translateX(-50%)",
  minWidth: 82,
  padding: "7px 9px",
  borderRadius: 10,
  background: "rgba(15,23,42,0.92)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 10px 22px rgba(0,0,0,0.3)",
  color: "#e2e8f0",
  fontSize: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  zIndex: 80,
  pointerEvents: "none",
},

  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "end",
    flexWrap: "wrap",
    marginBottom: 10,
  },

  drawBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 16,
  },

  toolGroup: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },

  toolSep: {
    width: 1,
    height: 28,
    background: "rgba(255,255,255,0.1)",
    margin: "0 4px",
  },

  colorDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
    padding: 0,
    minHeight: 0,
  },

  boardConfigBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    margin: "-6px 0 14px",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(255,255,255,0.07)",
  },

  fieldSizeGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },

  fieldSizeLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    color: "#94a3b8",
  },

  fieldSizeInput: {
    width: 58,
    background: "rgba(255,255,255,0.05)",
    color: "#f8fafc",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9,
    padding: "6px 7px",
    fontWeight: 900,
    outline: "none",
  },

  framesGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  schemaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 11px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },

  schemaLoadBtn: {
    border: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(37,99,235,0.14)",
    color: "#93c5fd",
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1.2,
  },

  exportExerciseBtn: {
    width: "100%",
    marginBottom: 4,
    padding: "9px 14px",
    borderRadius: 11,
    border: "1px solid rgba(34,197,94,0.3)",
    background: "rgba(34,197,94,0.1)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.2,
  },

  frameAddButton: {
    border: "1px solid rgba(96,165,250,0.25)",
    background: "rgba(37,99,235,0.16)",
    color: "#dbeafe",
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  frameButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    fontWeight: 900,
    cursor: "pointer",
  },

  frameButtonActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid rgba(147,197,253,0.6)",
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  },

  select: {
    minWidth: 155,
    backgroundColor: "#0f172a",
    color: "#fff",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 14,
    padding: "11px 12px",
    fontWeight: 900,
    outline: "none",
    colorScheme: "dark",
  },

  actions: {
    marginLeft: "auto",
    display: "flex",
    gap: 10,
  },

  secondaryButton: {
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  primaryButton: {
    border: "1px solid rgba(96,165,250,0.25)",
    background: "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.7))",
    color: "#fff",
    borderRadius: 14,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "10 / 6.6",
    minHeight: 520,
    overflow: "hidden",
    borderRadius: 30,
    background:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 26%), linear-gradient(180deg, rgba(34,197,94,0.42), rgba(20,83,45,0.28)), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 72px, transparent 72px, transparent 144px)",
    border: "2px solid rgba(134,239,172,0.22)",
    boxShadow: "inset 0 0 90px rgba(0,0,0,0.32), 0 24px 60px rgba(0,0,0,0.28)",
  },

  svgLayer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 15,
    overflow: "visible",
  },

  editorBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "10px 12px",
    margin: "-6px 0 14px",
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  editorMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    color: "#e2e8f0",
    fontSize: 12,
    minWidth: 220,
    flex: 1,
  },

  editorSelect: {
    backgroundColor: "#0f172a",
    color: "#fff",
    border: "1px solid rgba(148,163,184,0.22)",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 800,
    outline: "none",
    colorScheme: "dark",
  },

  editorValue: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    padding: "9px 10px",
    borderRadius: 12,
    background: "rgba(37,99,235,0.14)",
    border: "1px solid rgba(96,165,250,0.18)",
  },

  objectControls: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(150px, 1fr))",
    gap: 10,
    minWidth: 320,
  },

  rangeLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(37,99,235,0.14)",
    border: "1px solid rgba(96,165,250,0.18)",
  },

  rangeInput: {
    width: "100%",
    accentColor: "#60a5fa",
  },

  dangerButton: {
    border: "1px solid rgba(248,113,113,0.24)",
    background: "rgba(239,68,68,0.14)",
    color: "#fecaca",
    borderRadius: 12,
    padding: "9px 12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  objectHandle: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #ffffff",
    background: "#0f172a",
    padding: 0,
    zIndex: 90,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  },

  pitchTexture: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(15,23,42,0.32), transparent 18%, transparent 82%, rgba(15,23,42,0.32))",
    pointerEvents: "none",
  },

  halfwayLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    background: "rgba(255,255,255,0.25)",
  },

  zoneTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "25%",
    borderTop: "1px dashed rgba(255,255,255,0.22)",
  },

  zoneBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "75%",
    borderTop: "1px dashed rgba(255,255,255,0.22)",
  },

  centerCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 112,
    height: 112,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.23)",
    transform: "translate(-50%, -50%)",
  },

  centerSpot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.5)",
    transform: "translate(-50%, -50%)",
  },

  boxTop: {
    position: "absolute",
    left: "25%",
    top: 0,
    width: "50%",
    height: "16%",
    border: "2px solid rgba(255,255,255,0.18)",
    borderTop: "none",
  },

  smallBoxTop: {
    position: "absolute",
    left: "39%",
    top: 0,
    width: "22%",
    height: "7%",
    border: "2px solid rgba(255,255,255,0.13)",
    borderTop: "none",
  },

  boxBottom: {
    position: "absolute",
    left: "25%",
    bottom: 0,
    width: "50%",
    height: "16%",
    border: "2px solid rgba(255,255,255,0.18)",
    borderBottom: "none",
  },

  smallBoxBottom: {
    position: "absolute",
    left: "39%",
    bottom: 0,
    width: "22%",
    height: "7%",
    border: "2px solid rgba(255,255,255,0.13)",
    borderBottom: "none",
  },

 player: {
  position: "absolute",
  width: 42,
  height: 50,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "grab",
  userSelect: "none",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
  zIndex: 30,
  transition: "0.15s ease",
  filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.38))",
},

 ownPlayer: {
  background: "transparent",
},

opponentPlayer: {
  background: "transparent",
  zIndex: 25,
},



  selectedPlayer: {
    outline: "2px solid rgba(147,197,253,0.95)",
    outlineOffset: 4,
  },

  compatiblePlayer: {
    outline: "2px solid rgba(34,197,94,0.95)",
    outlineOffset: 4,
  },

  playerNumber: {
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1,
  },



  legend: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
  },

  dotBlue: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#3b82f6",
    boxShadow: "0 0 12px rgba(59,130,246,0.8)",
  },

  dotRed: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#ef4444",
    boxShadow: "0 0 12px rgba(239,68,68,0.8)",
  },

  notes: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  note: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "#94a3b8",
    fontSize: 13,
  },

  noteTextarea: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.5,
    padding: "8px 10px",
    resize: "vertical",
    outline: "none",
    marginTop: 2,
    boxSizing: "border-box",
    minHeight: 68,
  },

  lineup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  lineupPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    cursor: "pointer",
  },

  lineupNumber: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 950,
    flexShrink: 0,
  },

  lineupInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#cbd5e1",
    fontSize: 12,
  },

  emptyLineup: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.1)",
    color: "#94a3b8",
    fontSize: 13,
  },

  slotHint: {
    marginBottom: 12,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 900,
  },

  bench: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  benchPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
  },

  benchPlayerSelected: {
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.12)",
  },

  benchNumber: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 950,
    flexShrink: 0,
  },

    benchInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#94a3b8",
    fontSize: 12,
  },

  toolsBar: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 18,
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
};
