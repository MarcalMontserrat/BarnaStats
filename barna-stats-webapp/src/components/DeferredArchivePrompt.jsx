function DeferredArchivePrompt({
    styles,
    eyebrow,
    title,
    body,
    summary,
    buttonLabel = "Cargar archivo completo",
    onRequest
}) {
    return (
        <div style={styles.pageShell}>
            <section style={styles.syncIntro}>
                <div style={styles.syncEyebrow}>{eyebrow}</div>
                <h2 style={styles.syncTitle}>{title}</h2>
                <p style={styles.syncBody}>{body}</p>
                <div style={styles.competitionTabRow}>
                    <button
                        type="button"
                        style={styles.competitionTab}
                        onClick={onRequest}
                    >
                        {buttonLabel}
                    </button>
                </div>
            </section>

            <div style={styles.emptyState}>{summary}</div>
        </div>
    );
}

export default DeferredArchivePrompt;
