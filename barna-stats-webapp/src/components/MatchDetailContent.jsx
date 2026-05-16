import MatchInsightsPanel from "./MatchInsightsPanel.jsx";
import MatchReportPanel from "./MatchReportPanel.jsx";
import MatchTable from "./MatchTable.jsx";

const styles = {
    shell: {
        display: "grid",
        gap: 0,
        minWidth: 0
    },
    emptyState: {
        marginTop: 14,
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.82)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)",
        lineHeight: 1.55
    }
};

function MatchDetailContent({
    matchWebId,
    focusTeamIdExtern,
    focusTeamName,
    players,
    insights,
    matchReport,
    matchReportGeneratedAtUtc,
    matchReportModel,
    onPlayerNavigate,
    showMatchReport = true,
    enableMatchReportOnDemand = true,
    matchReportApiAvailable = true,
    tableWithTopMargin = true,
    emptyMessage = "No hay detalle disponible para este partido."
}) {
    const safePlayers = Array.isArray(players) ? players : [];
    const hasContent = safePlayers.length > 0
        || !!insights
        || !!matchReport
        || (showMatchReport && enableMatchReportOnDemand && !!matchWebId);

    if (!hasContent) {
        return (
            <div style={styles.emptyState}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div style={styles.shell}>
            {safePlayers.length > 0 ? (
                <MatchTable
                    players={safePlayers}
                    onPlayerNavigate={onPlayerNavigate}
                    withTopMargin={tableWithTopMargin}
                />
            ) : null}
            <MatchInsightsPanel insights={insights}/>
            {showMatchReport ? (
                <MatchReportPanel
                    matchWebId={matchWebId}
                    focusTeamIdExtern={focusTeamIdExtern}
                    focusTeamName={focusTeamName}
                    matchReport={matchReport}
                    matchReportGeneratedAtUtc={matchReportGeneratedAtUtc}
                    matchReportModel={matchReportModel}
                    enableOnDemand={enableMatchReportOnDemand}
                    apiAvailable={matchReportApiAvailable}
                />
            ) : null}
        </div>
    );
}

export default MatchDetailContent;
