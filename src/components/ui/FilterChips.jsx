export default function FilterChips({ label, options = [], value, onChange, className = "" }) {
  return (
    <div className={`cl-filter-group ${className}`.trim()} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`cl-filter-chip${value === option.value ? " is-selected" : ""}`}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count != null && <span className="cl-filter-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
