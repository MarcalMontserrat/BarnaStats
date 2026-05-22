export function formatDecimal(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

export function formatSignedNumber(value, digits = 0) {
    const number = Number(value ?? 0);
    const prefix = number > 0 ? "+" : "";

    return `${prefix}${number.toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}`;
}

export function formatRecordLine(record) {
    if ((record?.ties ?? 0) > 0) {
        return `${record?.wins ?? 0}-${record?.losses ?? 0}-${record?.ties ?? 0}`;
    }

    return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}
