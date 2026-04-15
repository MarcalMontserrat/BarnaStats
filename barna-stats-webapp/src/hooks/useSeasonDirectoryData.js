import {useEffect, useState} from "react";

export function useSeasonDirectoryData(enabled, version) {
    const [requestState, setRequestState] = useState(() => ({
        version: 0,
        index: null,
        seasons: [],
        error: ""
    }));

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        let cancelled = false;

        setRequestState({
            version,
            index: null,
            seasons: [],
            error: ""
        });

        const loadDirectory = async () => {
            try {
                const indexUrl = `data/seasons/index.json?v=${version}`;
                const indexResponse = await fetch(indexUrl);
                if (!indexResponse.ok) {
                    throw new Error(`No se pudo cargar ${indexUrl}`);
                }

                const index = await indexResponse.json();
                const seasons = await Promise.all(
                    (index?.seasons ?? []).map(async (season) => {
                        const analysisUrl = `data/${season.analysisFile}?v=${version}`;
                        const competitionUrl = `data/${season.competitionFile}?v=${version}`;
                        const [analysisResponse, competitionResponse] = await Promise.all([
                            fetch(analysisUrl),
                            fetch(competitionUrl)
                        ]);

                        if (!analysisResponse.ok) {
                            throw new Error(`No se pudo cargar ${analysisUrl}`);
                        }

                        if (!competitionResponse.ok) {
                            throw new Error(`No se pudo cargar ${competitionUrl}`);
                        }

                        const [analysis, competition] = await Promise.all([
                            analysisResponse.json(),
                            competitionResponse.json()
                        ]);

                        return {
                            ...season,
                            analysis,
                            competition
                        };
                    })
                );

                if (!cancelled) {
                    setRequestState({
                        version,
                        index,
                        seasons,
                        error: ""
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setRequestState({
                        version,
                        index: null,
                        seasons: [],
                        error: String(error)
                    });
                }
            }
        };

        void loadDirectory();

        return () => {
            cancelled = true;
        };
    }, [enabled, version]);

    const isCurrentRequest = enabled && requestState.version === version;

    return {
        index: isCurrentRequest ? requestState.index : null,
        seasons: isCurrentRequest ? requestState.seasons : [],
        loading: !!enabled && !isCurrentRequest,
        error: isCurrentRequest ? requestState.error : ""
    };
}
