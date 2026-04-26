function normalizeComparableLabel(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function compareOptionLabels(left, right) {
    const normalizedLeft = normalizeComparableLabel(left);
    const normalizedRight = normalizeComparableLabel(right);

    return normalizedLeft.localeCompare(normalizedRight, "es", {
        numeric: true,
        sensitivity: "base"
    });
}

export function sortFilterOptions(options, fallbackCompare = null) {
    return [...(options ?? [])].sort((left, right) => {
        const labelDelta = compareOptionLabels(left?.label, right?.label);
        if (labelDelta !== 0) {
            return labelDelta;
        }

        if (typeof fallbackCompare === "function") {
            return fallbackCompare(left, right);
        }

        return compareOptionLabels(left?.value, right?.value);
    });
}

export function sortFilterOptionsKeepingGlobalFirst(options, isGlobalOption) {
    const globalOptions = [];
    const regularOptions = [];

    for (const option of options ?? []) {
        if (isGlobalOption?.(option)) {
            globalOptions.push(option);
        } else {
            regularOptions.push(option);
        }
    }

    return [
        ...sortFilterOptions(globalOptions),
        ...sortFilterOptions(regularOptions)
    ];
}

export function dedupFilterOptions(options) {
    const seen = new Set();
    return (options ?? []).filter((option) => {
        const key = option?.value;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
