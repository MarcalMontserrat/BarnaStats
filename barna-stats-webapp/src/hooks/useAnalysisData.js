import {useEffect, useState} from "react";

export function useAnalysisData(url) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`No se pudo cargar ${url}`);
                }

                return response.json();
            })
            .then((payload) => {
                if (!cancelled) {
                    setAnalysis(payload);
                    setError("");
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(String(err));
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [url]);

    return {
        analysis,
        loading,
        error
    };
}
