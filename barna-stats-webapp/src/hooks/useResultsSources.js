import {useCallback, useEffect, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

export function useResultsSources(enabled = true) {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingPhaseId, setDeletingPhaseId] = useState(null);

    const refreshSources = useCallback(async () => {
        if (!enabled) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/results-sources`);

            if (!response.ok) {
                throw new Error("No se pudo leer el catálogo de fases guardadas.");
            }

            const payload = await response.json();
            setSources(Array.isArray(payload) ? payload : []);
            setError("");
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        void refreshSources();
    }, [enabled, refreshSources]);

    const deleteSource = useCallback(async (phaseId) => {
        const normalizedPhaseId = Number(phaseId);
        if (!enabled || !Number.isInteger(normalizedPhaseId) || normalizedPhaseId <= 0) {
            return false;
        }

        setDeletingPhaseId(normalizedPhaseId);
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/results-sources/${normalizedPhaseId}`, {
                method: "DELETE"
            });
            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                throw new Error(payload?.error ?? "No se pudo borrar la fase guardada.");
            }

            setSources((currentSources) => currentSources.filter((source) => Number(source.phaseId) !== normalizedPhaseId));
            setError(payload?.warning ?? "");
            return payload ?? true;
        } catch (err) {
            setError(String(err));
            return false;
        } finally {
            setDeletingPhaseId(null);
        }
    }, [enabled]);

    return {
        sources: enabled ? sources : [],
        loading: enabled ? loading : false,
        error: enabled ? error : "",
        deletingPhaseId: enabled ? deletingPhaseId : null,
        deleteSource,
        refreshSources
    };
}
