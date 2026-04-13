import "./PrettySelect.css";

function PrettySelect({
    label,
    value,
    onChange,
    children,
    ariaLabel,
    minWidth = "260px",
    labelColor = "var(--muted)"
}) {
    return (
        <label
            className="pretty-select-field"
            style={{
                "--pretty-select-min-width": minWidth,
                "--pretty-select-label-color": labelColor
            }}
        >
            {label ? <span className="pretty-select-label">{label}</span> : null}
            <span className="pretty-select-shell">
                <select
                    className="pretty-select-control"
                    value={value}
                    onChange={onChange}
                    aria-label={ariaLabel ?? label}
                >
                    {children}
                </select>
            </span>
        </label>
    );
}

export default PrettySelect;
