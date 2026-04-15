import {Children} from "react";
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
    const options = Children.toArray(children)
        .filter((child) => child?.props);
    const selectedOption = options.find((child) => String(child.props.value ?? "") === String(value ?? ""));
    const selectedLabel = String(selectedOption?.props?.children ?? "");
    const longestOptionLabelLength = options.reduce((maxLength, child) => {
        const optionLabel = String(child?.props?.children ?? "").trim();
        return Math.max(maxLength, optionLabel.length);
    }, 0);
    const referenceLength = Math.max(
        String(label ?? "").trim().length,
        selectedLabel.trim().length,
        longestOptionLabelLength,
        14
    );
    const idealWidth = `calc(${Math.min(referenceLength + 4, 44)}ch + 2.5rem)`;

    return (
        <label
            className="pretty-select-field"
            style={{
                "--pretty-select-min-width": minWidth,
                "--pretty-select-label-color": labelColor,
                "--pretty-select-ideal-width": idealWidth
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
