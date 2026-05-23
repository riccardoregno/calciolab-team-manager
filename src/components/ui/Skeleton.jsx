/**
 * Skeleton — placeholder animato per stati di caricamento.
 *
 * Uso:
 *   <Skeleton width="100%" height={20} />
 *   <Skeleton variant="circle" size={40} />
 *   <Skeleton variant="card" />
 *   <SkeletonPlayerCard />
 *   <SkeletonList rows={5} />
 */

const shimmer = `
  @keyframes calciolab-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
`;

// Inject keyframe once
if (typeof document !== "undefined") {
  if (!document.getElementById("calciolab-shimmer-style")) {
    const style = document.createElement("style");
    style.id = "calciolab-shimmer-style";
    style.textContent = shimmer;
    document.head.appendChild(style);
  }
}

const BASE = {
  borderRadius: 8,
  background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 75%)",
  backgroundSize: "200% 100%",
  animation: "calciolab-shimmer 1.4s ease infinite",
  display: "block",
};

export default function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style = {},
  variant, // "circle" | "card"
  size,    // for circle
}) {
  if (variant === "circle") {
    const s = size || 40;
    return (
      <span
        style={{
          ...BASE,
          width: s,
          height: s,
          borderRadius: "50%",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  if (variant === "card") {
    return (
      <div
        style={{
          ...BASE,
          width,
          height: height || 120,
          borderRadius: 14,
          ...style,
        }}
      />
    );
  }

  return (
    <span
      style={{
        ...BASE,
        display: "block",
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

// ─── Preset: card giocatore ───────────────────────────────────────────────────
export function SkeletonPlayerCard() {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton variant="circle" size={48} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={11} />
        </div>
      </div>
      <Skeleton width="100%" height={10} />
      <Skeleton width="75%" height={10} />
    </div>
  );
}

// ─── Preset: riga lista ───────────────────────────────────────────────────────
export function SkeletonRow({ cols = 3 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <Skeleton variant="circle" size={36} />
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={i === 0 ? "30%" : "20%"} height={12} />
      ))}
    </div>
  );
}

// ─── Preset: lista N righe ────────────────────────────────────────────────────
export function SkeletonList({ rows = 4, cols = 3 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

// ─── Preset: griglia card ─────────────────────────────────────────────────────
export function SkeletonGrid({ count = 6 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 18,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPlayerCard key={i} />
      ))}
    </div>
  );
}

// ─── Preset: stat card ────────────────────────────────────────────────────────
export function SkeletonStatCard() {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Skeleton width="40%" height={22} />
      <Skeleton width="65%" height={10} />
    </div>
  );
}
