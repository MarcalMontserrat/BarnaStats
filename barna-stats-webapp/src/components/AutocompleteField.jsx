import {useState} from "react";

const styles = {
    shell: {
        position: "relative",
        minWidth: "min(100%, 380px)"
    },
    label: {
        display: "grid",
        gap: 8,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--muted)"
    },
    input: {
        width: "100%",
        minHeight: 50,
        padding: "0 16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid rgba(107, 86, 58, 0.16)",
        background: "rgba(255, 251, 245, 0.96)",
        color: "var(--navy)",
        fontSize: 15,
        fontWeight: 700,
        boxShadow: "var(--shadow-sm)",
        outline: "none"
    },
    list: {
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        display: "grid",
        gap: 6,
        padding: 8,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 252, 247, 0.98)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        boxShadow: "0 18px 36px rgba(25, 22, 18, 0.12)",
        zIndex: 20,
        maxHeight: 320,
        overflowY: "auto"
    },
    option: {
        display: "grid",
        gap: 4,
        width: "100%",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: "rgba(255, 248, 240, 0.88)",
        color: "var(--navy)",
        textAlign: "left",
        cursor: "pointer"
    },
    optionActive: {
        background: "rgba(26, 53, 87, 0.08)"
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: 800
    },
    optionMeta: {
        fontSize: 12,
        color: "var(--muted)",
        lineHeight: 1.5
    },
    empty: {
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        color: "var(--muted)",
        background: "rgba(245, 236, 224, 0.56)"
    }
};

function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function AutocompleteField({
    label,
    value,
    onValueChange,
    options,
    onSelectOption,
    placeholder,
    ariaLabel,
    noResultsText = "No hay resultados",
    minWidth = "380px",
    maxResults = 8
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const query = normalizeSearchText(value);
    const filteredOptions = (options ?? [])
        .filter((option) => {
            if (!query) {
                return true;
            }

            const haystack = normalizeSearchText(option.searchText || `${option.label} ${option.meta ?? ""}`);
            return haystack.includes(query);
        })
        .slice(0, maxResults);

    const selectOption = (option) => {
        onValueChange(option.label);
        onSelectOption(option);
        setIsOpen(false);
        setHighlightedIndex(0);
    };

    return (
        <div style={{...styles.shell, minWidth}}>
            <label style={styles.label}>
                {label}
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    aria-label={ariaLabel}
                    autoComplete="off"
                    style={styles.input}
                    onFocus={() => {
                        setIsOpen(true);
                    }}
                    onBlur={() => {
                        window.setTimeout(() => {
                            setIsOpen(false);
                        }, 120);
                    }}
                    onChange={(event) => {
                        onValueChange(event.target.value);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={(event) => {
                        if (!isOpen || filteredOptions.length === 0) {
                            return;
                        }

                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setHighlightedIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
                            return;
                        }

                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setHighlightedIndex((index) => Math.max(index - 1, 0));
                            return;
                        }

                        if (event.key === "Enter") {
                            event.preventDefault();
                            selectOption(filteredOptions[highlightedIndex]);
                            return;
                        }

                        if (event.key === "Escape") {
                            setIsOpen(false);
                        }
                    }}
                />
            </label>

            {isOpen ? (
                <div style={styles.list}>
                    {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
                        <button
                            key={option.value}
                            type="button"
                            style={index === highlightedIndex
                                ? {...styles.option, ...styles.optionActive}
                                : styles.option}
                            onMouseEnter={() => {
                                setHighlightedIndex(index);
                            }}
                            onMouseDown={() => {
                                selectOption(option);
                            }}
                        >
                            <span style={styles.optionLabel}>{option.label}</span>
                            {option.meta ? (
                                <span style={styles.optionMeta}>{option.meta}</span>
                            ) : null}
                        </button>
                    )) : (
                        <div style={styles.empty}>{noResultsText}</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default AutocompleteField;
