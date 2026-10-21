import { Search, X } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Cerca..." }) {
  return (
    <div
      className="cl-search"
      style={{
        width: "100%",
        maxWidth: 360,
        position: "relative",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#64748b",
          fontSize: 15,
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        <Search size={17} strokeWidth={1.8} />
      </span>

      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onChange(""); }}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "white",
          borderRadius: 12,
          padding: value ? "12px 48px 12px 38px" : "12px 15px 12px 38px",
          minHeight: 44,
          fontWeight: 500,
          lineHeight: 1.2,
        }}
      />

      {value && (
        <button
          type="button"
          aria-label="Cancella ricerca"
          onClick={() => onChange("")}
          style={{
            position: "absolute",
            right: 2,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            minHeight: 44,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
            color: "#cbd5e1",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
