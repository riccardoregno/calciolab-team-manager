export default function SearchBar({ value, onChange, placeholder = "Cerca..." }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        maxWidth: 360,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "white",
        borderRadius: 16,
        padding: "13px 15px",
        outline: "none",
        fontWeight: 600,
      }}
    />
  );
}
