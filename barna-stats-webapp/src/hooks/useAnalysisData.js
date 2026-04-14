import {useEffect, useState} from "react";

export function useAnalysisData(url) {
    const [requestState, setRequestState] = useState(() => ({
        url: null,
        analysis: null,
        error: ""
    }));

    useEffect(() => {
        if (!url) {
            return undefined;
        }

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
                    setRequestState({
                        url,
                        analysis: payload,
                        error: ""
                    });
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setRequestState({
                        url,
                        analysis: null,
                        error: String(err)
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [url]);

    const isCurrentRequest = !!url && requestState.url === url;

    return {
        analysis: url && isCurrentRequest ? requestState.analysis : null,
        loading: !!url && !isCurrentRequest,
        error: url && isCurrentRequest ? requestState.error : ""
    };
}
