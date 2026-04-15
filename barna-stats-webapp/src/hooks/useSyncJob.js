import {useCallback, useEffect, useRef, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

export function useSyncJob(enabled = true, onJobSucceeded) {
    const [job, setJob] = useState(null);
    const [apiAvailable, setApiAvailable] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");
    const completedJobRef = useRef("");

    const refreshCurrentJob = useCallback(async () => {
        if (!enabled) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/sync-jobs/current`);

            if (response.status === 204) {
                setApiAvailable(true);
                setJob(null);
                return;
            }

            if (!response.ok) {
                throw new Error("No se pudo leer el estado de sincronización.");
            }

            const payload = await response.json();
            setApiAvailable(true);
            setError("");
            setJob(payload);
        } catch (err) {
            setApiAvailable(false);
            setError(String(err));
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        void refreshCurrentJob();
    }, [enabled, refreshCurrentJob]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        if (job?.status !== "pending" && job?.status !== "running") {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            void refreshCurrentJob();
        }, 1500);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [enabled, job?.status, refreshCurrentJob]);

    useEffect(() => {
        if (!job || job.status === "pending" || job.status === "running") {
            return;
        }

        if (completedJobRef.current === job.jobId) {
            return;
        }

        completedJobRef.current = job.jobId;

        if (job.status === "succeeded" || job.analysisUpdatedAtUtc) {
            onJobSucceeded?.(job);
        }
    }, [enabled, job, onJobSucceeded]);

    async function startSync(sourceUrl) {
        if (!enabled) {
            return false;
        }

        setStarting(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/sync-jobs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sourceUrl,
                    forceRefresh: true
                })
            });

            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                setApiAvailable(true);

                if (payload?.currentJob) {
                    setJob(payload.currentJob);
                }

                throw new Error(payload?.error ?? "No se pudo arrancar la sincronización.");
            }

            setApiAvailable(true);
            setJob(payload);
            return true;
        } catch (err) {
            setError(String(err));
            return false;
        } finally {
            setStarting(false);
        }
    }

    async function startSyncBatch(sources, description = "") {
        if (!enabled) {
            return false;
        }

        setStarting(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/sync-jobs/batch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sources,
                    description,
                    forceRefresh: true
                })
            });

            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                setApiAvailable(true);

                if (payload?.currentJob) {
                    setJob(payload.currentJob);
                }

                throw new Error(payload?.error ?? "No se pudo arrancar la sincronización por lotes.");
            }

            setApiAvailable(true);
            setJob(payload);
            return true;
        } catch (err) {
            setError(String(err));
            return false;
        } finally {
            setStarting(false);
        }
    }

    async function startSyncAllSavedSources() {
        if (!enabled) {
            return false;
        }

        setStarting(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/results-sources/sync-all`, {
                method: "POST"
            });

            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                setApiAvailable(true);

                if (payload?.currentJob) {
                    setJob(payload.currentJob);
                }

                throw new Error(payload?.error ?? "No se pudo arrancar la sincronización completa.");
            }

            setApiAvailable(true);
            setJob(payload);
            return true;
        } catch (err) {
            setError(String(err));
            return false;
        } finally {
            setStarting(false);
        }
    }

    return {
        apiAvailable: enabled ? apiAvailable : false,
        starting: enabled ? starting : false,
        error: enabled ? error : "",
        job: enabled ? job : null,
        startSync,
        startSyncBatch,
        startSyncAllSavedSources,
        refreshCurrentJob
    };
}
