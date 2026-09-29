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
    const [deleteProgress, setDeleteProgress] = useState(null);

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
        setDeleteProgress({total: normalizedPhaseIds.length});
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/results-sources/delete-batch`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({phaseIds: normalizedPhaseIds})
            });
            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                throw new Error(payload?.error ?? "No se pudieron borrar las fases guardadas.");
            }

            const deletedPhaseIds = normalizePhaseIds(payload?.deletedPhaseIds);
            const failedPhaseIds = normalizePhaseIds(payload?.missingPhaseIds);

            if (deletedPhaseIds.length > 0) {
                setSources((currentSources) => currentSources.filter((source) => !deletedPhaseIds.includes(Number(source.phaseId))));
            }

            if (payload?.warning) {
                setError(payload.warning);
            } else if (failedPhaseIds.length > 0) {
                setError(`No se encontraron las fases: ${failedPhaseIds.join(", ")}.`);
            } else {
                setError("");
            }

            return {
                deletedPhaseIds,
                failedPhaseIds,
                results: payload ? [payload] : []
            };
        } catch (err) {
            setError(String(err));
            return {
                deletedPhaseIds: [],
                failedPhaseIds: normalizedPhaseIds,
                results: []
            };
        } finally {
            setDeletingPhaseIds([]);
            setDeleteProgress(null);
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
        deleteProgress: enabled ? deleteProgress : null,
        deleteSource,
        deleteSources,
        refreshSources
    };
}
