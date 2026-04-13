using System.Text.RegularExpressions;
using BarnaStats.Models;
using Microsoft.Playwright;

namespace BarnaStats.Services;

public sealed class MatchMappingSyncService
{
    private const int AutomaticRetryAttempts = 5;
    private const int AutomaticRetryDelayMs = 2000;
    private const int DirectMappingProximityWindow = 700;

    private static readonly Regex UuidRouteRegex = new(
        "/estadistiques/([a-f0-9]{24})(?:[/?#\"'<> ]|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex UuidJsonRegex = new(
        "\"(?:uuid(?:Match)?|guid(?:Estadistiques)?|statsGuid|estadistiquesGuid|guidStats)\"\\s*:\\s*\"([a-f0-9]{24})\"",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex UuidAttributeRegex = new(
        "(?:data-(?:uuid|guid|stats-guid|estadistiques-guid)|(?:uuid|guid))\\s*=\\s*[\"']([a-f0-9]{24})[\"']",
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
                : "Pulsa ENTER cuando la página de basquetcatala esté visible."
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

        var discoveredMappings = string.IsNullOrWhiteSpace(sourceUrl)
            ? Array.Empty<MatchDiscovery>()
            : await DiscoverMappingsAsync(page, sourceUrl, interactive);

        var discoveredMatchWebIds = discoveredMappings
            .Select(x => x.MatchWebId)
            .Distinct()
            .OrderBy(x => x)
            .ToList();

        var targetMatchWebIds = BuildTargetMatchWebIds(
            existingMappings,
            explicitMatchWebIds,
            discoveredMatchWebIds,
            includeAll);

        foreach (var discovery in discoveredMappings)
        {
            if (!string.IsNullOrWhiteSpace(discovery.UuidMatch))
                resolved[discovery.MatchWebId] = discovery.UuidMatch;
        }

        Console.WriteLine();
        Console.WriteLine($"Mappings actuales: {existingMappings.Count}");
        if (!string.IsNullOrWhiteSpace(sourceUrl))
        {
            Console.WriteLine($"Partidos encontrados en la fuente: {discoveredMappings.Count}");
            Console.WriteLine($"UUIDs directos encontrados     : {discoveredMappings.Count(x => !string.IsNullOrWhiteSpace(x.UuidMatch))}");
        }

        Console.WriteLine($"Partidos a resolver: {targetMatchWebIds.Count(matchWebId => !resolved.ContainsKey(matchWebId))}");

        foreach (var matchWebId in targetMatchWebIds)
        {
            if (resolved.TryGetValue(matchWebId, out var directUuid) && !string.IsNullOrWhiteSpace(directUuid))
                continue;

            resolved[matchWebId] = await ResolveSingleAsync(page, matchWebId, interactive);
        }

        return new MatchMappingSyncResult
        {
            DiscoveredMappings = discoveredMappings,
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

    private async Task<IReadOnlyList<MatchDiscovery>> DiscoverMappingsAsync(IPage page, string sourceUrl, bool interactive)
    {
        for (var attempt = 1; ; attempt += 1)
        {
            var discoveredMappings = IsResultsUrl(sourceUrl)
                ? await DiscoverMappingsFromResultsAsync(page, sourceUrl)
                : await DiscoverMappingsAcrossCalendarsAsync(page, sourceUrl);

            if (discoveredMappings.Count > 0)
            {
                Console.WriteLine($"  OK -> {discoveredMappings.Count} partidos encontrados");
                return discoveredMappings;
            }

            Console.WriteLine("  No se pudo extraer ningún partido de la fuente.");
            Console.WriteLine($"  URL actual: {page.Url}");

            if (!interactive)
            {
                if (attempt >= AutomaticRetryAttempts)
                {
                    Console.WriteLine("  SKIP automático de la fuente tras agotar reintentos.");
                    return Array.Empty<MatchDiscovery>();
                }

                Console.WriteLine($"  Reintentando automáticamente en {AutomaticRetryDelayMs / 1000.0:0.#} s ({attempt}/{AutomaticRetryAttempts})...");
                await page.WaitForTimeoutAsync(AutomaticRetryDelayMs);
                continue;
            }

            Console.WriteLine("  Revisa la página en el navegador, resuelve captcha si aparece y pulsa ENTER para reintentar.");
            Console.WriteLine("  Escribe 'skip' y pulsa ENTER para continuar sin usar la fuente.");

            var input = Console.ReadLine()?.Trim().ToLowerInvariant();
            if (input == "skip")
            {
                Console.WriteLine("  SKIP");
                return Array.Empty<MatchDiscovery>();
            }
        }
    }

    private async Task<IReadOnlyList<MatchDiscovery>> DiscoverMappingsFromResultsAsync(IPage page, string sourceUrl)
    {
        var capturedResponses = new List<IResponse>();
        void HandleResponse(object? _, IResponse response) => capturedResponses.Add(response);

        Console.WriteLine($"Buscando partidos en resultados: {sourceUrl}");

        page.Response += HandleResponse;

        try
        {
            await page.GotoAsync(sourceUrl, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.DOMContentLoaded
            });

            await page.WaitForTimeoutAsync(1500);

            var discovered = new Dictionary<int, MatchDiscovery>();

            MergeDiscoveries(discovered, await ExtractMappingsFromPageAsync(page));

            foreach (var responseText in await ReadRelevantResponseTextsAsync(capturedResponses))
            {
                MergeDiscoveries(discovered, ExtractDirectMappingsFromText(responseText));
                EnsureMatchWebIds(discovered, ExtractMatchWebIdsFromText(responseText));
            }

            return discovered.Values
                .OrderBy(x => x.MatchWebId)
                .ToList();
        }
        finally
        {
            page.Response -= HandleResponse;
        }
    }

    private async Task<IReadOnlyList<MatchDiscovery>> DiscoverMappingsAcrossCalendarsAsync(IPage page, string sourceUrl)
    {
        var queue = new Queue<string>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var visitedUrls = new List<string>();
        var discovered = new Dictionary<int, MatchDiscovery>();

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

                MergeDiscoveries(discovered, await ExtractMappingsFromPageAsync(page));

                foreach (var relatedCalendarUrl in await ExtractCalendarUrlsAsync(page, currentUrl))
                    EnqueueCalendarUrl(relatedCalendarUrl, queue, seenUrls);

                foreach (var responseText in await ReadRelevantResponseTextsAsync(capturedResponses))
                {
                    MergeDiscoveries(discovered, ExtractDirectMappingsFromText(responseText));
                    EnsureMatchWebIds(discovered, ExtractMatchWebIdsFromText(responseText));

                    foreach (var relatedCalendarUrl in ExtractCalendarUrlsFromText(responseText, currentUrl))
                        EnqueueCalendarUrl(relatedCalendarUrl, queue, seenUrls);
                }
            }
            finally
            {
                page.Response -= HandleResponse;
            }
        }

        if (visitedUrls.Count > 1)
            Console.WriteLine($"  Calendarios revisados: {visitedUrls.Count}");

        return discovered.Values
            .OrderBy(x => x.MatchWebId)
            .ToList();
    }

    private async Task<IReadOnlyList<MatchDiscovery>> ExtractMappingsFromPageAsync(IPage page)
    {
        var discovered = new Dictionary<int, MatchDiscovery>();

        EnsureMatchWebIds(discovered, await ExtractMatchWebIdsAsync(page));

        var html = await page.ContentAsync();
        MergeDiscoveries(discovered, ExtractDirectMappingsFromText(html));

        return discovered.Values
            .OrderBy(x => x.MatchWebId)
            .ToList();
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

    private static bool IsResultsUrl(string sourceUrl)
    {
        return Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) &&
               uri.AbsolutePath.Contains("/competicions/resultats/", StringComparison.OrdinalIgnoreCase);
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
        return ExtractUuidsFromText(html).FirstOrDefault();
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
        var rawMatches = ExtractMatchWebIdsFromText(html);

        return domMatchWebIds
            .Concat(rawMatches)
            .Distinct()
            .OrderBy(matchWebId => matchWebId)
            .ToList();
    }

    private static void MergeDiscoveries(IDictionary<int, MatchDiscovery> target, IEnumerable<MatchDiscovery> discoveries)
    {
        foreach (var discovery in discoveries)
        {
            if (!target.TryGetValue(discovery.MatchWebId, out var existing))
            {
                target[discovery.MatchWebId] = discovery;
                continue;
            }

            if (string.IsNullOrWhiteSpace(existing.UuidMatch) && !string.IsNullOrWhiteSpace(discovery.UuidMatch))
            {
                target[discovery.MatchWebId] = discovery;
            }
        }
    }

    private static void EnsureMatchWebIds(IDictionary<int, MatchDiscovery> target, IEnumerable<int> matchWebIds)
    {
        foreach (var matchWebId in matchWebIds)
        {
            if (target.ContainsKey(matchWebId))
                continue;

            target[matchWebId] = new MatchDiscovery { MatchWebId = matchWebId };
        }
    }

    private static IReadOnlyList<MatchDiscovery> ExtractDirectMappingsFromText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return Array.Empty<MatchDiscovery>();

        var normalizedText = text.Replace("\\/", "/");
        var discovered = new Dictionary<int, MatchDiscovery>();

        foreach (var chunk in EnumerateCandidateChunks(normalizedText))
        {
            var matchWebIds = ExtractMatchWebIdsFromText(chunk);
            var uuids = ExtractUuidsFromText(chunk);

            if (matchWebIds.Count != 1 || uuids.Count == 0)
                continue;

            discovered[matchWebIds[0]] = new MatchDiscovery
            {
                MatchWebId = matchWebIds[0],
                UuidMatch = uuids[0]
            };
        }

        if (discovered.Count > 0)
            return discovered.Values.OrderBy(x => x.MatchWebId).ToList();

        var uuidOccurrences = ExtractUuidOccurrences(normalizedText);

        foreach (var occurrence in ExtractMatchWebIdOccurrences(normalizedText))
        {
            var nearestUuid = uuidOccurrences
                .Select(uuidOccurrence => new
                {
                    uuidOccurrence.Uuid,
                    Distance = Math.Abs(uuidOccurrence.Index - occurrence.Index)
                })
                .Where(x => x.Distance <= DirectMappingProximityWindow)
                .OrderBy(x => x.Distance)
                .FirstOrDefault();

            if (nearestUuid is null)
                continue;

            discovered[occurrence.MatchWebId] = new MatchDiscovery
            {
                MatchWebId = occurrence.MatchWebId,
                UuidMatch = nearestUuid.Uuid
            };
        }

        return discovered.Values
            .OrderBy(x => x.MatchWebId)
            .ToList();
    }

    private static IEnumerable<string> EnumerateCandidateChunks(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            yield break;

        var chunks = Regex.Split(
            text,
            @"(?:</tr>|</li>|</article>|</section>|</tbody>|""\s*}\s*,\s*{""|\}\s*,\s*\{|\n\s*\n)",
            RegexOptions.IgnoreCase);

        foreach (var chunk in chunks)
        {
            if (string.IsNullOrWhiteSpace(chunk))
                continue;

            if (!ContainsPotentialMatchWebId(chunk) || !ContainsPotentialUuid(chunk))
                continue;

            yield return chunk;
        }
    }

    private static bool ContainsPotentialMatchWebId(string text)
    {
        return MatchWebIdRouteRegex.IsMatch(text) ||
               MatchWebIdJsonRegex.IsMatch(text) ||
               MatchWebIdDataAttributeRegex.IsMatch(text) ||
               MatchWebIdScriptRegex.IsMatch(text);
    }

    private static bool ContainsPotentialUuid(string text)
    {
        return UuidRouteRegex.IsMatch(text) ||
               UuidJsonRegex.IsMatch(text) ||
               UuidAttributeRegex.IsMatch(text);
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

    private static IReadOnlyList<string> ExtractUuidsFromText(string text)
    {
        return new[]
            {
                UuidRouteRegex,
                UuidJsonRegex,
                UuidAttributeRegex
            }
            .SelectMany(regex => regex.Matches(text).Select(match => match.Groups[1].Value))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.ToLowerInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static IReadOnlyList<(int MatchWebId, int Index)> ExtractMatchWebIdOccurrences(string text)
    {
        return new[]
            {
                MatchWebIdRouteRegex,
                MatchWebIdJsonRegex,
                MatchWebIdDataAttributeRegex,
                MatchWebIdScriptRegex
            }
            .SelectMany(regex => regex.Matches(text).Select(match => (MatchWebId: ParseMatchWebId(match.Groups[1].Value), Index: match.Index)))
            .Where(x => x.MatchWebId > 0)
            .OrderBy(x => x.Index)
            .ToList();
    }

    private static IReadOnlyList<(string Uuid, int Index)> ExtractUuidOccurrences(string text)
    {
        return new[]
            {
                UuidRouteRegex,
                UuidJsonRegex,
                UuidAttributeRegex
            }
            .SelectMany(regex => regex.Matches(text).Select(match => (Uuid: match.Groups[1].Value.ToLowerInvariant(), Index: match.Index)))
            .Where(x => !string.IsNullOrWhiteSpace(x.Uuid))
            .OrderBy(x => x.Index)
            .ToList();
    }

    private static int ParseMatchWebId(string value)
    {
        return int.TryParse(value, out var matchWebId) ? matchWebId : 0;
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
        {
            return uri.AbsolutePath.Contains("/partits/", StringComparison.OrdinalIgnoreCase) ||
                   uri.AbsolutePath.Contains("/competicions/", StringComparison.OrdinalIgnoreCase);
        }

        return contentType.Contains("html", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("json", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("text", StringComparison.OrdinalIgnoreCase);
    }
}
