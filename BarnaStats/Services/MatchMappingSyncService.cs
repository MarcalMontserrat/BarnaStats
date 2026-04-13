using System.Text.RegularExpressions;
using BarnaStats.Models;
using Microsoft.Playwright;

namespace BarnaStats.Services;

public sealed class MatchMappingSyncService
{
    private const int AutomaticRetryAttempts = 5;
    private const int AutomaticRetryDelayMs = 2000;

    private static readonly Regex UuidRegex = new(
        "/estadistiques/([a-f0-9]{24})(?:[/?#\"'<> ]|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MatchWebIdRouteRegex = new(
        "(?:/|\\\\/)partits(?:/|\\\\/)llistatpartits(?:/|\\\\/)(\\d+)(?:[/?#\"'<> ]|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MatchWebIdJsonRegex = new(
        "\"matchWebId\"\\s*:\\s*(\\d+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MatchWebIdDataAttributeRegex = new(
        "data-match(?:-web)?-id\\s*=\\s*[\"']?(\\d+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MatchWebIdScriptRegex = new(
        "showPartit\\((\\d+)\\)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CalendarUrlRegex = new(
        "(https?://[^\"'<>\\s]*basquetcatala\\.cat)?(?:/|\\\\/)partits(?:/|\\\\/)calendari[^\"'<>\\s)]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly string _browserProfileDir;

    public MatchMappingSyncService(string browserProfileDir)
    {
        _browserProfileDir = browserProfileDir;
    }

    public async Task<MatchMappingSyncResult> SyncAsync(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        bool includeAll,
        string? sourceUrl = null,
        bool interactive = true)
    {
        var resolved = new Dictionary<int, string?>();

        using var playwright = await Playwright.CreateAsync();
        await using var browser = await LaunchContextAsync(playwright);

        var page = browser.Pages.FirstOrDefault() ?? await browser.NewPageAsync();
        var startUrl = string.IsNullOrWhiteSpace(sourceUrl)
            ? "https://www.basquetcatala.cat/"
            : sourceUrl;

        Console.WriteLine("Se abrirá un navegador real para reutilizar tu sesión.");
        Console.WriteLine("Si aparece login o captcha, resuélvelo ahí y vuelve al terminal.");
        Console.WriteLine(interactive
            ? string.IsNullOrWhiteSpace(sourceUrl)
                ? "Pulsa ENTER cuando la web de basquetcatala esté lista."
                : "Pulsa ENTER cuando el calendario del equipo esté visible."
            : "El proceso seguirá reintentando automáticamente mientras resuelves captcha/login en el navegador.");

        await page.GotoAsync(startUrl, new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded
        });

        if (interactive)
        {
            Console.ReadLine();
        }
        else
        {
            await page.WaitForTimeoutAsync(1000);
        }

        var discoveredMatchWebIds = string.IsNullOrWhiteSpace(sourceUrl)
            ? Array.Empty<int>()
            : await DiscoverMatchWebIdsAsync(page, sourceUrl, interactive);

        var targetMatchWebIds = BuildTargetMatchWebIds(
            existingMappings,
            explicitMatchWebIds,
            discoveredMatchWebIds,
            includeAll);

        Console.WriteLine();
        Console.WriteLine($"Mappings actuales: {existingMappings.Count}");
        if (!string.IsNullOrWhiteSpace(sourceUrl))
            Console.WriteLine($"Partidos encontrados en el calendario: {discoveredMatchWebIds.Count}");
        Console.WriteLine($"Partidos a resolver: {targetMatchWebIds.Count}");

        foreach (var matchWebId in targetMatchWebIds)
        {
            resolved[matchWebId] = await ResolveSingleAsync(page, matchWebId, interactive);
        }

        return new MatchMappingSyncResult
        {
            DiscoveredMatchWebIds = discoveredMatchWebIds,
            TargetMatchWebIds = targetMatchWebIds,
            ResolvedUuids = resolved
        };
    }

    private async Task<string?> ResolveSingleAsync(IPage page, int matchWebId, bool interactive)
    {
        for (var attempt = 1; ; attempt += 1)
        {
            Console.WriteLine($"Resolviendo uuid para matchWebId={matchWebId}...");

            await page.GotoAsync(
                $"https://www.basquetcatala.cat/partits/llistatpartits/{matchWebId}",
                new PageGotoOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded
                });

            await page.WaitForTimeoutAsync(1000);

            var uuid = await ExtractUuidAsync(page);
            if (!string.IsNullOrWhiteSpace(uuid))
            {
                Console.WriteLine($"  OK -> {uuid}");
                return uuid;
            }

            Console.WriteLine("  No se pudo extraer el uuid automáticamente.");
            Console.WriteLine($"  URL actual: {page.Url}");

            if (!interactive)
            {
                if (attempt >= AutomaticRetryAttempts)
                {
                    Console.WriteLine("  SKIP automático tras agotar reintentos.");
                    return null;
                }

                Console.WriteLine($"  Reintentando automáticamente en {AutomaticRetryDelayMs / 1000.0:0.#} s ({attempt}/{AutomaticRetryAttempts})...");
                await page.WaitForTimeoutAsync(AutomaticRetryDelayMs);
                continue;
            }

            Console.WriteLine("  Revisa la página en el navegador, resuelve captcha si aparece y pulsa ENTER para reintentar.");
            Console.WriteLine("  Escribe 'skip' y pulsa ENTER para saltar este partido.");

            var input = Console.ReadLine()?.Trim().ToLowerInvariant();
            if (input == "skip")
            {
                Console.WriteLine("  SKIP");
                return null;
            }
        }
    }

    private async Task<IBrowserContext> LaunchContextAsync(IPlaywright playwright)
    {
        Directory.CreateDirectory(_browserProfileDir);

        try
        {
            return await playwright.Chromium.LaunchPersistentContextAsync(
                _browserProfileDir,
                new BrowserTypeLaunchPersistentContextOptions
                {
                    Headless = false,
                    Channel = "chrome"
                });
        }
        catch (PlaywrightException ex) when (CanFallbackToBundledChromium(ex))
        {
            Console.WriteLine("No se pudo abrir Chrome del sistema. Intentando Chromium de Playwright...");

            return await playwright.Chromium.LaunchPersistentContextAsync(
                _browserProfileDir,
                new BrowserTypeLaunchPersistentContextOptions
                {
                    Headless = false
                });
        }
    }

    private static bool CanFallbackToBundledChromium(PlaywrightException ex)
    {
        var message = ex.Message ?? "";
        return message.Contains("channel", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("executable", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Cannot find", StringComparison.OrdinalIgnoreCase);
    }

    private static List<int> BuildTargetMatchWebIds(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        IReadOnlyCollection<int> discoveredMatchWebIds,
        bool includeAll)
    {
        var mappingsById = existingMappings.ToDictionary(x => x.MatchWebId);
        var explicitIds = explicitMatchWebIds
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (includeAll)
        {
            return existingMappings
                .Select(x => x.MatchWebId)
                .Concat(explicitIds)
                .Concat(discoveredMatchWebIds)
                .Distinct()
                .OrderBy(x => x)
                .ToList();
        }

        if (explicitIds.Count > 0 || discoveredMatchWebIds.Count > 0)
        {
            return explicitIds
                .Concat(discoveredMatchWebIds.Where(matchWebId =>
                    !mappingsById.TryGetValue(matchWebId, out var mapping) ||
                    string.IsNullOrWhiteSpace(mapping.UuidMatch)))
                .Distinct()
                .OrderBy(x => x)
                .ToList();
        }

        return existingMappings
            .Where(x => string.IsNullOrWhiteSpace(x.UuidMatch))
            .Select(x => x.MatchWebId)
            .OrderBy(x => x)
            .ToList();
    }

    private async Task<IReadOnlyList<int>> DiscoverMatchWebIdsAsync(IPage page, string sourceUrl, bool interactive)
    {
        for (var attempt = 1; ; attempt += 1)
        {
            var (matchWebIds, visitedUrls) = await DiscoverMatchWebIdsAcrossCalendarsAsync(page, sourceUrl);
            if (matchWebIds.Count > 0)
            {
                Console.WriteLine($"  OK -> {matchWebIds.Count} matchWebId encontrados");
                if (visitedUrls.Count > 1)
                    Console.WriteLine($"  Calendarios revisados: {visitedUrls.Count}");
                return matchWebIds;
            }

            Console.WriteLine("  No se pudo extraer ningún matchWebId del calendario.");
            Console.WriteLine($"  URL actual: {page.Url}");

            if (!interactive)
            {
                if (attempt >= AutomaticRetryAttempts)
                {
                    Console.WriteLine("  SKIP automático del calendario tras agotar reintentos.");
                    return Array.Empty<int>();
                }

                Console.WriteLine($"  Reintentando automáticamente en {AutomaticRetryDelayMs / 1000.0:0.#} s ({attempt}/{AutomaticRetryAttempts})...");
                await page.WaitForTimeoutAsync(AutomaticRetryDelayMs);
                continue;
            }

            Console.WriteLine("  Revisa la página en el navegador, resuelve captcha si aparece y pulsa ENTER para reintentar.");
            Console.WriteLine("  Escribe 'skip' y pulsa ENTER para continuar sin usar el calendario.");

            var input = Console.ReadLine()?.Trim().ToLowerInvariant();
            if (input == "skip")
            {
                Console.WriteLine("  SKIP");
                return Array.Empty<int>();
            }
        }
    }

    private static async Task<string?> ExtractUuidAsync(IPage page)
    {
        var domUuid = await page.EvaluateAsync<string?>(
            """
            () => {
                const links = [...document.querySelectorAll('a[href]')];

                const statLinks = links.filter((a) =>
                    (a.textContent || '').toLowerCase().includes('estad')
                );

                const allCandidates = [...statLinks, ...links];

                for (const a of allCandidates) {
                    const href = a.getAttribute('href') || '';
                    const match = href.match(/\/estadistiques\/([a-f0-9]{24})(?:[/?#]|$)/i);
                    if (match) {
                        return match[1];
                    }
                }

                return null;
            }
            """);

        if (!string.IsNullOrWhiteSpace(domUuid))
            return domUuid;

        var html = await page.ContentAsync();
        var rawMatch = UuidRegex.Match(html);
        return rawMatch.Success ? rawMatch.Groups[1].Value : null;
    }

    private static async Task<IReadOnlyList<int>> ExtractMatchWebIdsAsync(IPage page)
    {
        var domMatchWebIds = await page.EvaluateAsync<int[]>(
            """
            () => {
                const values = [];
                const seen = new Set();
                const patterns = [
                    /(?:\/|\\\/)partits(?:\/|\\\/)llistatpartits(?:\/|\\\/)(\d+)(?:[/?#]|$)/ig,
                    /data-match(?:-web)?-id=["']?(\d+)/ig,
                    /"matchWebId"\s*:\s*(\d+)/ig,
                    /showPartit\((\d+)\)/ig
                ];

                const add = (value) => {
                    const parsed = Number.parseInt(value, 10);
                    if (Number.isInteger(parsed) && parsed > 0 && !seen.has(parsed)) {
                        seen.add(parsed);
                        values.push(parsed);
                    }
                };

                const collect = (text) => {
                    if (!text) {
                        return;
                    }

                    for (const pattern of patterns) {
                        pattern.lastIndex = 0;
                        let match;

                        while ((match = pattern.exec(text)) !== null) {
                            add(match[1]);

                            if (pattern.lastIndex === match.index) {
                                pattern.lastIndex += 1;
                            }
                        }
                    }
                };

                const selectors = [
                    'a[href]',
                    '[onclick]',
                    '[data-href]',
                    '[data-url]',
                    '[data-match-id]',
                    '[data-match-web-id]',
                    'form[action]'
                ];

                for (const element of document.querySelectorAll(selectors.join(','))) {
                    collect(element.getAttribute('href'));
                    collect(element.getAttribute('onclick'));
                    collect(element.getAttribute('data-href'));
                    collect(element.getAttribute('data-url'));
                    collect(element.getAttribute('data-match-id'));
                    collect(element.getAttribute('data-match-web-id'));
                    collect(element.getAttribute('action'));
                }

                collect(document.documentElement?.outerHTML || '');
                return values;
            }
            """);

        var html = await page.ContentAsync();
        var rawMatches = new[]
            {
                MatchWebIdRouteRegex,
                MatchWebIdJsonRegex,
                MatchWebIdDataAttributeRegex,
                MatchWebIdScriptRegex
            }
            .SelectMany(regex => regex.Matches(html).Select(match => match.Groups[1].Value))
            .Select(value => int.TryParse(value, out var matchWebId) ? matchWebId : 0)
            .Where(matchWebId => matchWebId > 0)
            .Distinct()
            .OrderBy(matchWebId => matchWebId)
            .ToList();

        return domMatchWebIds
            .Concat(rawMatches)
            .Distinct()
            .OrderBy(matchWebId => matchWebId)
            .ToList();
    }

    private async Task<(IReadOnlyList<int> MatchWebIds, IReadOnlyList<string> VisitedUrls)> DiscoverMatchWebIdsAcrossCalendarsAsync(
        IPage page,
        string sourceUrl)
    {
        var queue = new Queue<string>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var visitedUrls = new List<string>();
        var matchWebIds = new HashSet<int>();

        EnqueueCalendarUrl(sourceUrl, queue, seenUrls);

        while (queue.Count > 0 && visitedUrls.Count < 10)
        {
            var currentUrl = queue.Dequeue();
            visitedUrls.Add(currentUrl);
            var capturedResponses = new List<IResponse>();
            void HandleResponse(object? _, IResponse response) => capturedResponses.Add(response);

            Console.WriteLine($"Buscando partidos en: {currentUrl}");

            page.Response += HandleResponse;

            try
            {
                await page.GotoAsync(currentUrl, new PageGotoOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded
                });

                await page.WaitForTimeoutAsync(1500);

                foreach (var matchWebId in await ExtractMatchWebIdsAsync(page))
                {
                    matchWebIds.Add(matchWebId);
                }

                foreach (var relatedCalendarUrl in await ExtractCalendarUrlsAsync(page, currentUrl))
                {
                    EnqueueCalendarUrl(relatedCalendarUrl, queue, seenUrls);
                }

                foreach (var responseText in await ReadRelevantResponseTextsAsync(capturedResponses))
                {
                    foreach (var matchWebId in ExtractMatchWebIdsFromText(responseText))
                    {
                        matchWebIds.Add(matchWebId);
                    }

                    foreach (var relatedCalendarUrl in ExtractCalendarUrlsFromText(responseText, currentUrl))
                    {
                        EnqueueCalendarUrl(relatedCalendarUrl, queue, seenUrls);
                    }
                }
            }
            finally
            {
                page.Response -= HandleResponse;
            }
        }

        return (matchWebIds.OrderBy(x => x).ToList(), visitedUrls);
    }

    private static async Task<IReadOnlyList<string>> ExtractCalendarUrlsAsync(IPage page, string currentUrl)
    {
        var domCalendarUrls = await page.EvaluateAsync<string[]>(
            """
            () => {
                const values = [];
                const seen = new Set();
                const patterns = [
                    /https?:\/\/[^"' )]*basquetcatala\.cat(?:\/|\\\/)partits(?:\/|\\\/)calendari[^"' )]*/ig,
                    /(?:\/|\\\/)partits(?:\/|\\\/)calendari[^"' )]*/ig
                ];

                const add = (value) => {
                    if (!value) {
                        return;
                    }

                    const normalized = value.trim();
                    if (!normalized || seen.has(normalized)) {
                        return;
                    }

                    seen.add(normalized);
                    values.push(normalized);
                };

                const collect = (text) => {
                    if (!text) {
                        return;
                    }

                    for (const pattern of patterns) {
                        pattern.lastIndex = 0;
                        let match;

                        while ((match = pattern.exec(text)) !== null) {
                            add(match[0]);

                            if (pattern.lastIndex === match.index) {
                                pattern.lastIndex += 1;
                            }
                        }
                    }
                };

                const selectors = [
                    'a[href]',
                    '[onclick]',
                    '[data-href]',
                    '[data-url]',
                    'form[action]',
                    'option[value]'
                ];

                for (const element of document.querySelectorAll(selectors.join(','))) {
                    collect(element.getAttribute('href'));
                    collect(element.getAttribute('onclick'));
                    collect(element.getAttribute('data-href'));
                    collect(element.getAttribute('data-url'));
                    collect(element.getAttribute('action'));
                    collect(element.getAttribute('value'));
                }

                collect(document.documentElement?.outerHTML || '');
                return values;
            }
            """);

        var baseUri = new Uri(currentUrl);
        return domCalendarUrls
            .Select(value => NormalizeCalendarUrl(baseUri, value))
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Concat(ExtractCalendarUrlsFromText(await page.ContentAsync(), currentUrl))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(url => url, StringComparer.OrdinalIgnoreCase)
            .ToList()!;
    }

    private static string? NormalizeCalendarUrl(Uri baseUri, string candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
            return null;

        var sanitized = candidate
            .Trim()
            .Trim('"', '\'', ')', '>', ';')
            .Replace("\\/", "/");

        if (!Uri.TryCreate(baseUri, sanitized, out var resolvedUri))
            return null;

        if (!resolvedUri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
            return null;

        if (!resolvedUri.AbsolutePath.Contains("/partits/calendari", StringComparison.OrdinalIgnoreCase))
            return null;

        return resolvedUri.ToString();
    }

    private static void EnqueueCalendarUrl(string candidate, Queue<string> queue, HashSet<string> seenUrls)
    {
        if (string.IsNullOrWhiteSpace(candidate))
            return;

        if (!seenUrls.Add(candidate))
            return;

        queue.Enqueue(candidate);
    }

    private static IReadOnlyList<int> ExtractMatchWebIdsFromText(string text)
    {
        return new[]
            {
                MatchWebIdRouteRegex,
                MatchWebIdJsonRegex,
                MatchWebIdDataAttributeRegex,
                MatchWebIdScriptRegex
            }
            .SelectMany(regex => regex.Matches(text).Select(match => match.Groups[1].Value))
            .Select(value => int.TryParse(value, out var matchWebId) ? matchWebId : 0)
            .Where(matchWebId => matchWebId > 0)
            .Distinct()
            .OrderBy(matchWebId => matchWebId)
            .ToList();
    }

    private static IReadOnlyList<string> ExtractCalendarUrlsFromText(string text, string currentUrl)
    {
        var baseUri = new Uri(currentUrl);
        return CalendarUrlRegex
            .Matches(text)
            .Select(match => NormalizeCalendarUrl(baseUri, match.Value))
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(url => url, StringComparer.OrdinalIgnoreCase)
            .ToList()!;
    }

    private static async Task<IReadOnlyList<string>> ReadRelevantResponseTextsAsync(IReadOnlyList<IResponse> responses)
    {
        var texts = new List<string>();

        foreach (var response in responses
                     .Where(ShouldInspectResponse)
                     .DistinctBy(response => response.Url))
        {
            texts.Add(response.Url);

            try
            {
                texts.Add(await response.TextAsync());
            }
            catch
            {
                // Algunas respuestas no son legibles como texto; se ignoran.
            }
        }

        return texts;
    }

    private static bool ShouldInspectResponse(IResponse response)
    {
        if (!Uri.TryCreate(response.Url, UriKind.Absolute, out var uri))
            return false;

        if (!uri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
            return false;

        var contentType = response.Headers.TryGetValue("content-type", out var value)
            ? value
            : string.Empty;

        if (string.IsNullOrWhiteSpace(contentType))
            return uri.AbsolutePath.Contains("/partits/", StringComparison.OrdinalIgnoreCase);

        return contentType.Contains("html", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("json", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("text", StringComparison.OrdinalIgnoreCase);
    }
}
