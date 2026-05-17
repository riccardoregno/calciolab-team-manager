export default function SearchBar({ value, onChange, placeholder = "Cerca..." }) {
  return (
    <div
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
        &#8981;
      </span>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "white",
          borderRadius: 12,
          padding: value ? "12px 42px 12px 38px" : "12px 15px 12px 38px",
          outline: "none",
          fontWeight: 650,
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
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            width: 28,
            height: 28,
            minHeight: 0,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
            color: "#cbd5e1",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
