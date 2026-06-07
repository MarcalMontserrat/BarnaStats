import {lazy, Suspense} from "react";
import {useResultsSources} from "../hooks/useResultsSources.js";
import {useSyncJob} from "../hooks/useSyncJob.js";
import appStyles from "../styles/appStyles.js";
import SectionFallback from "../components/SectionFallback.jsx";

const SyncPanel = lazy(() => import("../components/SyncPanel.jsx"));

function SyncPage({syncUiEnabled, onAnalysisVersionChange}) {
    const {
        sources: savedResultsSources,
        loading: savedResultsSourcesLoading,
        error: savedResultsSourcesError,
        deletingPhaseIds: deletingSavedPhaseIds,
        deleteProgress: deleteProgress,
        deleteSource: deleteSavedResultsSource,
        deleteSources: deleteSavedResultsSources,
        refreshSources: refreshSavedResultsSources
    } = useResultsSources(syncUiEnabled);
    const {
        apiAvailable,
        starting: syncStarting,
        error: syncError,
        job,
        startSync,
        startSyncBatch,
        startSyncAllSavedSources
    } = useSyncJob(syncUiEnabled, () => {
        onAnalysisVersionChange(Date.now());
        void refreshSavedResultsSources();
    });

    return (
        <div style={appStyles.syncPage}>
            <section style={appStyles.syncIntro}>
                <div style={appStyles.syncEyebrow}>Ingesta</div>
                <h2 style={appStyles.syncTitle}>Importa una fase completa desde la fuente oficial</h2>
                <p style={appStyles.syncBody}>
                    Pega la URL de resultados y deja que el pipeline descargue los partidos y actualice la web sin pasar por la consola.
                </p>
            </section>

            <Suspense fallback={<SectionFallback message="Cargando panel de sincronización..." />}>
                <SyncPanel
                    apiAvailable={apiAvailable}
                    job={job}
                    starting={syncStarting}
                    error={syncError}
                    savedSources={savedResultsSources}
                    savedSourcesLoading={savedResultsSourcesLoading}
                    savedSourcesError={savedResultsSourcesError}
                    deletingPhaseIds={deletingSavedPhaseIds}
                    deleteProgress={deleteProgress}
                    onStartSync={startSync}
                    onStartSyncBatch={startSyncBatch}
                    onStartSyncAllSavedSources={startSyncAllSavedSources}
                    onDeleteSavedSource={async (phaseId) => {
                        const result = await deleteSavedResultsSource(phaseId);
                        if (result) {
                            onAnalysisVersionChange(Date.now());
                        }

                        return result;
                    }}
                    onDeleteSavedSources={async (phaseIds) => {
                        const result = await deleteSavedResultsSources(phaseIds);
                        if ((result?.deletedPhaseIds?.length ?? 0) > 0) {
                            onAnalysisVersionChange(Date.now());
                        }

                        return result;
                    }}
                />
            </Suspense>
        </div>
    );
}

export default SyncPage;
