import {useEffect, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

const styles = {
    box: {
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        fontSize: 13,
        lineHeight: 1.6
    },
    ok: {
        background: "rgba(228, 241, 228, 0.7)",
        border: "1px solid rgba(45, 93, 52, 0.22)",
        color: "#2d5d34"
    },
    warning: {
        background: "rgba(254, 240, 203, 0.55)",
        border: "1px solid rgba(210, 160, 52, 0.24)",
        color: "#7a5700"
    },
    title: {
        fontWeight: 800
    },
    code: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12
    }
};

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-ES");
}

// Estado de la cuenta de la app de Bàsquet Català: si se puede descargar el detalle de las categorías que la
// web pública solo muestra con marcador (p. ej. Pre-mini).
function AppAccountStatus({apiAvailable, refreshKey}) {
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (!apiAvailable) {
            return undefined;
        }

        let cancelled = false;

        fetch(`${API_BASE_URL}/api/app-account/status`)
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (!cancelled) {
                    setStatus(payload);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [apiAvailable, refreshKey]);

    if (!apiAvailable || !status) {
        return null;
    }

    const settingsFile = <span style={styles.code}>BarnaStats/out/local-settings.json</span>;

    if (!status.configured) {
        return (
            <div style={{...styles.box, ...styles.warning}}>
                <div style={styles.title}>Cuenta de la app no configurada</div>
                Falta {status.missingFields.join(", ")}. Las categorías que la web pública solo publica con marcador
                (p. ej. Pre-mini) se quedarán sin jugadoras. Configúrala en {settingsFile}.
                {status.error ? <div>{status.error}</div> : null}
            </div>
        );
    }

    const tokenInfo = status.tokenExpiresAtUtc ? ` · sesión válida hasta ${formatDate(status.tokenExpiresAtUtc)}` : "";
    const passwordNote = !status.passwordConfigured ? (
        <div>
            Sin contraseña configurada: funciona con la sesión guardada, pero cuando caduque hará falta para volver a
            entrar.{status.error ? ` ${status.error}` : ""}
        </div>
    ) : status.error ? <div>{status.error}</div> : null;

    return (
        <div style={{...styles.box, ...styles.ok}}>
            <div style={styles.title}>Cuenta de la app configurada ({status.source}){tokenInfo}</div>
            {status.appMatches} partidos descargados con la cuenta.
            {passwordNote}
        </div>
    );
}

export default AppAccountStatus;
