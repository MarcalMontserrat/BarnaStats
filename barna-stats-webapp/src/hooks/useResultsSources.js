import {useCallback, useEffect, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

function normalizePhaseIds(phaseIds) {
    return [...new Set(
        [...(phaseIds ?? [])]
            .map((phaseId) => Number(phaseId))
            .filter((phaseId) => Number.isInteger(phaseId) && phaseId > 0)
    )];
}

export function useResultsSources(enabled = true) {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingPhaseIds, setDeletingPhaseIds] = useState([]);

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

    const deleteSources = useCallback(async (phaseIds) => {
        const normalizedPhaseIds = normalizePhaseIds(phaseIds);
        if (!enabled || normalizedPhaseIds.length === 0) {
            return {
                deletedPhaseIds: [],
                failedPhaseIds: [],
                results: []
            };
        }

        setDeletingPhaseIds(normalizedPhaseIds);
        setError("");

        const deletedPhaseIds = [];
        const failedPhaseIds = [];
        const warningMessages = [];
        const failureMessages = [];
        const results = [];

        try {
            for (const phaseId of normalizedPhaseIds) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/results-sources/${phaseId}`, {
                        method: "DELETE"
                    });
                    const hasJson = response.headers
                        .get("content-type")
                        ?.includes("application/json");
                    const payload = hasJson ? await response.json() : null;

                    if (!response.ok) {
                        throw new Error(payload?.error ?? "No se pudo borrar la fase guardada.");
                    }

                    deletedPhaseIds.push(phaseId);
                    results.push(payload ?? true);
                    if (payload?.warning) {
                        warningMessages.push(payload.warning);
                    }
                } catch (err) {
                    const message = String(err);
                    failedPhaseIds.push(phaseId);
                    failureMessages.push(`Fase ${phaseId}: ${message}`);
                }
            }

            if (deletedPhaseIds.length > 0) {
                setSources((currentSources) => currentSources.filter((source) => !deletedPhaseIds.includes(Number(source.phaseId))));
            }

            if (failureMessages.length > 0) {
                setError(failureMessages.join(" "));
            } else if (warningMessages.length > 0) {
                setError([...new Set(warningMessages)].join(" "));
            } else {
                setError("");
            }

            return {
                deletedPhaseIds,
                failedPhaseIds,
                results
            };
        } finally {
            setDeletingPhaseIds([]);
        }
    }, [enabled]);

    const deleteSource = useCallback(async (phaseId) => {
        const outcome = await deleteSources([phaseId]);
        return outcome.deletedPhaseIds.length > 0
            ? (outcome.results[0] ?? true)
            : false;
    }, [deleteSources]);

    return {
        sources: enabled ? sources : [],
        loading: enabled ? loading : false,
        error: enabled ? error : "",
        deletingPhaseIds: enabled ? deletingPhaseIds : [],
        deleteSource,
        deleteSources,
        refreshSources
    };
}
