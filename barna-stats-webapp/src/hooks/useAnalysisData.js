import {useEffect, useState} from "react";

const resolvedCache = new Map();
const inFlightCache = new Map();

export function useAnalysisData(url) {
    const [requestState, setRequestState] = useState(() => ({
        url: null,
        analysis: null,
        error: ""
    }));
    const hasCachedPayload = !!url && resolvedCache.has(url);
    const cachedPayload = hasCachedPayload ? resolvedCache.get(url) : null;

    useEffect(() => {
        if (!url) {
            return undefined;
        }

        let cancelled = false;

        if (resolvedCache.has(url)) {
            return () => {
                cancelled = true;
            };
        }

        const existingRequest = inFlightCache.get(url);
        const request = existingRequest ?? fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`No se pudo cargar ${url}`);
                }

                return response.json();
            })
            .then((payload) => {
                resolvedCache.set(url, payload);
                inFlightCache.delete(url);
                return payload;
            })
            .catch((error) => {
                inFlightCache.delete(url);
                throw error;
            });

        if (!existingRequest) {
            inFlightCache.set(url, request);
        }

        request.then((payload) => {
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
    const analysis = hasCachedPayload
        ? cachedPayload
        : (isCurrentRequest ? requestState.analysis : null);
    const error = hasCachedPayload
        ? ""
        : (isCurrentRequest ? requestState.error : "");

    return {
        analysis,
        loading: !!url && !analysis && !error,
        error
    };
}
