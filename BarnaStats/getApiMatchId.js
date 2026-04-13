// Primero hay que obtener los matchWebId correctos. 
// Cambiar el Array
// luego ejectuar el script directamente ne la consola del navegador
// esto nos dara la tabla de relacion matchWebId - apiMatchId (uuid) que necesitamos para luego obtener las estadisticas de cada partido


(async () => {
    const matchWebIds = [
        34914, 34921, 34924, 34928, 34929, 34936, 34939, 34943,
        65987, 65990, 65993, 65996, 69002, 66002, 66005, 66011,
        66008, 69007
    ];

    const results = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function extractUuidFromHtml(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // 1. Prioridad: link cuyo texto contiene "Estadística"
        const statLinks = [...doc.querySelectorAll('a[href]')].filter(a =>
            (a.textContent || '').toLowerCase().includes('estad')
        );

        for (const a of statLinks) {
            const href = a.getAttribute('href') || '';
            const m = href.match(/\/estadistiques\/([a-f0-9]{24})(?:[/?#]|$)/i);
            if (m) return m[1];
        }

        // 2. Fallback: cualquier link con /estadistiques/{uuid}
        const allLinks = [...doc.querySelectorAll('a[href]')];
        for (const a of allLinks) {
            const href = a.getAttribute('href') || '';
            const m = href.match(/\/estadistiques\/([a-f0-9]{24})(?:[/?#]|$)/i);
            if (m) return m[1];
        }

        // 3. Último fallback: regex en bruto
        const raw = html.match(/\/estadistiques\/([a-f0-9]{24})(?:[/?#"'<> ]|$)/i);
        return raw?.[1] ?? null;
    }

    for (const matchWebId of matchWebIds) {
        try {
            const res = await fetch(`/partits/llistatpartits/${matchWebId}`, {
                credentials: 'include'
            });

            const html = await res.text();
            const uuidMatch = extractUuidFromHtml(html);

            results.push({
                matchWebId,
                status: res.status,
                uuidMatch
            });

            await sleep(250);
        } catch (err) {
            results.push({
                matchWebId,
                status: 'ERROR',
                uuidMatch: null,
                error: String(err)
            });
        }
    }

    console.table(results);

    const csv = [
        'matchWebId,status,uuidMatch',
        ...results.map(r => `${r.matchWebId},${r.status},${r.uuidMatch ?? ''}`)
    ].join('\n');

    copy(csv);
    console.log(csv);
})();