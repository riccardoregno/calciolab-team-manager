import { layout } from "./layout";
import { buttons } from "./buttons";
import { cards } from "./cards";
import { calendar } from "./calendar";

export const styles = {
  ...layout,
  ...buttons,
  ...cards,
  ...calendar,

  timelineMoveButtons: {
  display: "flex",
  flexDirection: "column",
  gap: 6,
},
savedSessionsList: {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 16,
},

savedSessionCard: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 16,
  background: "#111827",
  border: "1px solid #263244",
},
sessionActions: {
  display: "flex",
  gap: 8,
},
sessionFormGrid: {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 12,
  marginBottom: 16,
},
sessionStats: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginTop: 12,
},

sessionStatCard: {
  background: "#111827",
  border: "1px solid #263244",
  borderRadius: 16,
  padding: 16,
},

sessionStatValue: {
  fontSize: 18,
  fontWeight: 700,
  color: "white",
},

sessionStatLabel: {
  fontSize: 12,
  color: "#9ca3af",
  marginTop: 4,
},
savedSessionTitleRow: {
  display: "flex",
  alignItems: "center",
  gap: 8,
},

templateBadge: {
  background: "#1d4ed8",
  color: "white",
  fontSize: 10,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 999,
  letterSpacing: 0.5,
},

sessionGrid: {
  display: "grid",
  gridTemplateColumns: "350px 1fr",
  gap: 20,
},

timeline: {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 16,
},

timelineBlock: {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #263244",
},

blockNote: {
  width: "100%",
  marginTop: 6,
},

exerciseLibraryList: {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 12,
},

exerciseLibraryItem: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
},

input: {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #263244",
  background: "#0f172a",
  color: "white",
  marginTop: 10,
},

cardTitle: {
  fontSize: 18,
  fontWeight: 600,
},

mutedText: {
  fontSize: 12,
  color: "#9ca3af",
},
};