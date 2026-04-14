using System.Text.RegularExpressions;
using BarnaStats.Models;
using Microsoft.Playwright;
using System.Globalization;
using System.Net;

namespace BarnaStats.Services;

public sealed class MatchMappingSyncService
{
    private const int AutomaticRetryAttempts = 5;
    private const int AutomaticRetryDelayMs = 2000;
    private const int DirectMappingProximityWindow = 700;
    private static readonly CultureInfo[] SupportedDateCultures =
    [
        new("ca-ES"),
        new("es-ES"),
        new("en-US"),
        CultureInfo.InvariantCulture
    ];

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
    private static readonly Regex NumericDateRegex = new(
        "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?\\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex TextualDateRegex = new(
        "\\b\\d{1,2}\\s+(?:de\\s+)?[A-Za-zÀ-ÿ]{3,12}\\s+(?:de\\s+)?\\d{2,4}(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?\\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex EnglishDateRegex = new(
        "\\b[A-Za-z]{3,12}\\s+\\d{1,2},\\s+\\d{4}(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM)?)?\\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HtmlTagRegex = new(
        "<[^>]+>",
        RegexOptions.Compiled);
    private static readonly Regex TitleCategoryRegex = new(
        @"id\s*=\s*[""']titleCategory[""'][^>]*>(.*?)</",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex SubTitleRegex = new(
        @"id\s*=\s*[""']subTitle[""'][^>]*>(.*?)</",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex SegmentSeparatorRegex = new(
        @"\s*-\s*",
        RegexOptions.Compiled);
    private static readonly Regex LevelPrefixRegex = new(
        @"^(nivell|nivel)\s+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex GroupPrefixRegex = new(
        @"^(grup|grupo)\s+",
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

        var sourceInspection = string.IsNullOrWhiteSpace(sourceUrl)
            ? null
            : await DiscoverMappingsAsync(page, sourceUrl, interactive);
        var discoveredMappings = sourceInspection?.DiscoveredMappings ?? Array.Empty<MatchDiscovery>();

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
            ResolvedUuids = resolved,
            PhaseMetadata = sourceInspection?.PhaseMetadata
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

    private async Task<ResultsSourceInspection> DiscoverMappingsAsync(IPage page, string sourceUrl, bool interactive)
    {
        for (var attempt = 1; ; attempt += 1)
        {
            var inspection = await DiscoverMappingsFromResultsAsync(page, sourceUrl);
            var discoveredMappings = inspection.DiscoveredMappings;

            if (discoveredMappings.Count > 0)
            {
                Console.WriteLine($"  OK -> {discoveredMappings.Count} partidos encontrados");
                if (inspection.PhaseMetadata is not null)
                {
                    var metadata = inspection.PhaseMetadata;
                    Console.WriteLine(
                        $"  Metadata -> {metadata.CategoryName ?? "sin categoría"} · {metadata.LevelName ?? "sin nivel"} · grupo {metadata.GroupCode ?? "?"}");
                }

                return inspection;
            }

            Console.WriteLine("  No se pudo extraer ningún partido de la fuente.");
            Console.WriteLine($"  URL actual: {page.Url}");

            if (!interactive)
            {
                if (attempt >= AutomaticRetryAttempts)
                {
                    Console.WriteLine("  SKIP automático de la fuente tras agotar reintentos.");
                    return ResultsSourceInspection.Empty;
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
                return ResultsSourceInspection.Empty;
            }
        }
    }

    private async Task<ResultsSourceInspection> DiscoverMappingsFromResultsAsync(IPage page, string sourceUrl)
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
            var phaseMetadata = await ExtractPhaseMetadataAsync(page, sourceUrl);

            MergeDiscoveries(discovered, await ExtractMappingsFromPageAsync(page));

            foreach (var responseText in await ReadRelevantResponseTextsAsync(capturedResponses))
            {
                MergeDiscoveries(discovered, ExtractDirectMappingsFromText(responseText));
            }

            return new ResultsSourceInspection
            {
                DiscoveredMappings = discovered.Values
                    .OrderBy(x => x.MatchWebId)
                    .ToList(),
                PhaseMetadata = phaseMetadata
            };
        }
        finally
        {
            page.Response -= HandleResponse;
        }
    }

    private async Task<IReadOnlyList<MatchDiscovery>> ExtractMappingsFromPageAsync(IPage page)
    {
        var html = await page.ContentAsync();
        return ExtractDirectMappingsFromText(html);
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
                .Where(mapping => !IsFutureMatch(mapping.MatchDate))
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
            .Where(x => string.IsNullOrWhiteSpace(x.UuidMatch) && !IsFutureMatch(x.MatchDate))
            .Select(x => x.MatchWebId)
            .OrderBy(x => x)
            .ToList();
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
            if (IsFutureMatch(discovery.MatchDate))
                continue;

            if (!target.TryGetValue(discovery.MatchWebId, out var existing))
            {
                target[discovery.MatchWebId] = discovery;
                continue;
            }

            var mergedDate = existing.MatchDate ?? discovery.MatchDate;
            var mergedUuid = string.IsNullOrWhiteSpace(existing.UuidMatch)
                ? discovery.UuidMatch
                : existing.UuidMatch;

            if (!string.IsNullOrWhiteSpace(discovery.UuidMatch))
            {
                mergedUuid = discovery.UuidMatch;
            }

            target[discovery.MatchWebId] = new MatchDiscovery
            {
                MatchWebId = discovery.MatchWebId,
                UuidMatch = mergedUuid,
                MatchDate = mergedDate
            };
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
            var discovery = TryExtractDiscoveryFromChunk(chunk);
            if (discovery is null)
                continue;

            discovered[discovery.MatchWebId] = discovery;
        }

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

            var matchDate = TryExtractMatchDateAroundIndex(normalizedText, occurrence.Index);
            if (IsFutureMatch(matchDate))
                continue;

            var existing = discovered.TryGetValue(occurrence.MatchWebId, out var existingDiscovery)
                ? existingDiscovery
                : null;

            discovered[occurrence.MatchWebId] = new MatchDiscovery
            {
                MatchWebId = occurrence.MatchWebId,
                UuidMatch = nearestUuid.Uuid,
                MatchDate = existing?.MatchDate ?? matchDate
            };
        }

        var firstOccurrenceByMatch = ExtractMatchWebIdOccurrences(normalizedText)
            .GroupBy(x => x.MatchWebId)
            .ToDictionary(group => group.Key, group => group.Min(item => item.Index));

        foreach (var matchWebId in discovered.Keys.ToList())
        {
            var current = discovered[matchWebId];
            if (current.MatchDate.HasValue)
                continue;

            if (!firstOccurrenceByMatch.TryGetValue(matchWebId, out var index))
                continue;

            var matchDate = TryExtractMatchDateAroundIndex(normalizedText, index);
            if (IsFutureMatch(matchDate))
            {
                discovered.Remove(matchWebId);
                continue;
            }

            if (!matchDate.HasValue)
                continue;

            discovered[matchWebId] = new MatchDiscovery
            {
                MatchWebId = current.MatchWebId,
                UuidMatch = current.UuidMatch,
                MatchDate = matchDate
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
            @"(?:<div id=""fila"">|<div class=""row rowJornada shadowRow"">|</tr>|</li>|</article>|</section>|</tbody>|""\s*}\s*,\s*{""|\}\s*,\s*\{|\n\s*\n)",
            RegexOptions.IgnoreCase);

        foreach (var chunk in chunks)
        {
            if (string.IsNullOrWhiteSpace(chunk))
                continue;

            if (!ContainsPotentialMatchWebId(chunk))
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

    private static MatchDiscovery? TryExtractDiscoveryFromChunk(string chunk)
    {
        var matchWebIds = ExtractMatchWebIdsFromText(chunk);
        if (matchWebIds.Count != 1)
            return null;

        var matchDate = TryExtractMatchDateFromText(chunk);
        if (IsFutureMatch(matchDate))
            return null;

        return new MatchDiscovery
        {
            MatchWebId = matchWebIds[0],
            UuidMatch = ExtractUuidsFromText(chunk).FirstOrDefault(),
            MatchDate = matchDate
        };
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

    private static DateTime? TryExtractMatchDateFromText(string text)
    {
        var normalizedText = NormalizeChunkText(text);

        foreach (var candidate in EnumerateDateCandidates(normalizedText))
        {
            if (TryParseMatchDate(candidate, out var matchDate))
                return matchDate;
        }

        return null;
    }

    private static DateTime? TryExtractMatchDateAroundIndex(string text, int index)
    {
        var start = Math.Max(0, index - 1800);
        var length = Math.Min(text.Length - start, 3200);
        var window = text.Substring(start, length);
        return TryExtractMatchDateFromText(window);
    }

    private static IEnumerable<string> EnumerateDateCandidates(string text)
    {
        foreach (var regex in new[] { NumericDateRegex, TextualDateRegex, EnglishDateRegex })
        {
            foreach (var match in regex.Matches(text).Cast<Match>())
            {
                var value = match.Value.Trim().Trim(',', '.', ';');
                if (!string.IsNullOrWhiteSpace(value))
                    yield return value;
            }
        }
    }

    private static string NormalizeChunkText(string text)
    {
        var withoutTags = HtmlTagRegex.Replace(text, " ");
        return Regex.Replace(withoutTags, "\\s+", " ").Trim();
    }

    private static bool TryParseMatchDate(string rawValue, out DateTime matchDate)
    {
        var sanitized = rawValue
            .Trim()
            .Replace(" h", "", StringComparison.OrdinalIgnoreCase)
            .Replace("h ", " ", StringComparison.OrdinalIgnoreCase);

        foreach (var culture in SupportedDateCultures)
        {
            if (DateTime.TryParse(
                    sanitized,
                    culture,
                    DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
                    out matchDate))
            {
                return true;
            }
        }

        matchDate = default;
        return false;
    }

    private static async Task<PhaseMetadata?> ExtractPhaseMetadataAsync(IPage page, string sourceUrl)
    {
        var categoryName = await TryGetTextContentAsync(page, "#titleCategory");
        var subTitle = await TryGetTextContentAsync(page, "#subTitle");

        if (string.IsNullOrWhiteSpace(categoryName) || string.IsNullOrWhiteSpace(subTitle))
        {
            var html = await page.ContentAsync();
            categoryName ??= ExtractElementTextById(html, TitleCategoryRegex);
            subTitle ??= ExtractElementTextById(html, SubTitleRegex);
        }

        categoryName = NormalizeMetadataValue(categoryName);
        subTitle = NormalizeMetadataValue(subTitle);

        if (string.IsNullOrWhiteSpace(categoryName) && string.IsNullOrWhiteSpace(subTitle))
            return null;

        var metadata = new PhaseMetadata
        {
            SourceUrl = sourceUrl,
            CategoryName = categoryName,
            SubTitle = subTitle
        };

        PopulatePhaseMetadata(metadata);
        return metadata;
    }

    private static async Task<string?> TryGetTextContentAsync(IPage page, string selector)
    {
        var locator = page.Locator(selector);
        if (await locator.CountAsync() == 0)
            return null;

        return await locator.First.TextContentAsync();
    }

    private static string? ExtractElementTextById(string html, Regex regex)
    {
        if (string.IsNullOrWhiteSpace(html))
            return null;

        var match = regex.Match(html);
        return match.Success ? match.Groups[1].Value : null;
    }

    private static string? NormalizeMetadataValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var decoded = WebUtility.HtmlDecode(value);
        var withoutTags = HtmlTagRegex.Replace(decoded, " ");
        var collapsed = Regex.Replace(withoutTags, "\\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(collapsed) ? null : collapsed;
    }

    private static void PopulatePhaseMetadata(PhaseMetadata metadata)
    {
        if (string.IsNullOrWhiteSpace(metadata.SubTitle))
            return;

        var segments = SegmentSeparatorRegex
            .Split(metadata.SubTitle)
            .Select(NormalizeMetadataValue)
            .Where(segment => !string.IsNullOrWhiteSpace(segment))
            .Cast<string>()
            .ToList();

        if (segments.Count == 0)
            return;

        metadata.PhaseName = segments[0];

        var levelSegment = segments
            .Skip(1)
            .FirstOrDefault(segment => LevelPrefixRegex.IsMatch(segment));

        if (string.IsNullOrWhiteSpace(levelSegment) && segments.Count >= 2)
        {
            levelSegment = segments[1];
        }

        metadata.LevelName = levelSegment;
        metadata.LevelCode = string.IsNullOrWhiteSpace(levelSegment)
            ? null
            : LevelPrefixRegex.Replace(levelSegment, "").Trim();

        var groupSegment = segments
            .Skip(1)
            .Where(segment => !string.Equals(segment, levelSegment, StringComparison.OrdinalIgnoreCase))
            .FirstOrDefault(segment =>
                GroupPrefixRegex.IsMatch(segment) ||
                Regex.IsMatch(segment, @"^[A-Z0-9/]+$", RegexOptions.IgnoreCase));

        if (string.IsNullOrWhiteSpace(groupSegment) && segments.Count >= 3)
        {
            groupSegment = segments[^1];
        }

        metadata.GroupCode = string.IsNullOrWhiteSpace(groupSegment)
            ? null
            : GroupPrefixRegex.Replace(groupSegment, "").Trim();
    }

    private static bool IsFutureMatch(DateTime? matchDate)
    {
        if (!matchDate.HasValue)
            return false;

        var localMatchDate = matchDate.Value;
        if (localMatchDate.TimeOfDay == TimeSpan.Zero)
            return localMatchDate.Date > DateTime.Today;

        return localMatchDate > DateTime.Now;
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

    private sealed class ResultsSourceInspection
    {
        public static ResultsSourceInspection Empty { get; } = new()
        {
            DiscoveredMappings = Array.Empty<MatchDiscovery>()
        };

        public required IReadOnlyList<MatchDiscovery> DiscoveredMappings { get; init; }
        public PhaseMetadata? PhaseMetadata { get; init; }
    }
}
