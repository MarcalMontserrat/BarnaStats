using System.Net;
using System.Text.RegularExpressions;
using BarnaStats.Api.Models;

namespace BarnaStats.Api.Services;

public sealed class BasquetCatalaLookupService
{
    private const int CategoryLookupConcurrency = 2;
    private const int PhaseLookupConcurrency = 3;
    private const int MaxRequestAttempts = 4;
    private static readonly TimeSpan BaseRetryDelay = TimeSpan.FromMilliseconds(450);

    private static readonly IReadOnlyDictionary<string, string> GenderLabels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["F"] = "Femenino",
        ["M"] = "Masculino"
    };

    private static readonly IReadOnlyDictionary<int, string> TerritoryLabels = new Dictionary<int, string>
    {
        [0] = "Todos los territorios",
        [1] = "Catalunya",
        [2] = "Barcelona",
        [3] = "Girona",
        [4] = "Lleida",
        [5] = "Tarragona",
        [6] = "Tot basquet"
    };

    private static readonly Regex OptionRegex = new(
        "<option\\s+value=\"(?<value>[^\"]+)\"[^>]*>(?<label>.*?)</option>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Singleline);

    private readonly HttpClient _httpClient;

    public BasquetCatalaLookupService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<LookupOption>> GetCategoriesAsync(string gender, int territory, CancellationToken cancellationToken = default)
    {
        var normalizedGender = NormalizeGender(gender);
        var normalizedTerritory = NormalizeTerritory(territory);

        return await GetOptionsAsync(
            $"ajax/combo_categories2/{normalizedGender}/{normalizedTerritory}",
            cancellationToken
        );
    }

    public async Task<IReadOnlyList<LookupOption>> GetPhasesAsync(int categoryId, string gender, int territory, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
            return [];

        var normalizedGender = NormalizeGender(gender);
        var normalizedTerritory = NormalizeTerritory(territory);

        return await GetOptionsAsync(
            $"ajax/combo_competicions2/{categoryId}/{normalizedGender}/{normalizedTerritory}",
            cancellationToken
        );
    }

    public async Task<DiscoverBulkSourcesResponse> DiscoverBulkSourcesAsync(
        IReadOnlyList<string> genders,
        IReadOnlyList<int> territories,
        CancellationToken cancellationToken = default)
    {
        var normalizedGenders = (genders ?? [])
            .Select(NormalizeGender)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var normalizedTerritories = (territories ?? [])
            .Select(NormalizeTerritory)
            .Distinct()
            .ToList();

        if (normalizedGenders.Count == 0 || normalizedTerritories.Count == 0)
        {
            return new DiscoverBulkSourcesResponse
            {
                Genders = normalizedGenders,
                Territories = normalizedTerritories
            };
        }

        var categorySemaphore = new SemaphoreSlim(CategoryLookupConcurrency);
        CategoryLookupScope[] categoryScopeResults;

        try
        {
            categoryScopeResults = await Task.WhenAll(
                normalizedGenders.SelectMany(gender =>
                    normalizedTerritories.Select(async territory =>
                    {
                        await categorySemaphore.WaitAsync(cancellationToken);
                        try
                        {
                            var categories = await GetCategoriesAsync(gender, territory, cancellationToken);
                            return new CategoryLookupScope(gender, territory, categories);
                        }
                        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
                        {
                            throw BuildScopeLookupException(
                                $"No se pudieron cargar las categorías para {GetGenderLabel(gender)} · {GetTerritoryLabel(territory)}.",
                                ex,
                                cancellationToken
                            );
                        }
                        finally
                        {
                            categorySemaphore.Release();
                        }
                    }))
            );
        }
        finally
        {
            categorySemaphore.Dispose();
        }

        var categoryScopes = categoryScopeResults
            .SelectMany(scope => scope.Categories.Select(category => new DiscoveredCategoryScopeState(
                scope.Gender,
                GetGenderLabel(scope.Gender),
                scope.Territory,
                GetTerritoryLabel(scope.Territory),
                ParseLookupValue(category.Value),
                category.Label
            )))
            .Where(scope => scope.CategoryId > 0)
            .OrderBy(scope => scope.GenderLabel, StringComparer.OrdinalIgnoreCase)
            .ThenBy(scope => scope.TerritoryLabel, StringComparer.OrdinalIgnoreCase)
            .ThenBy(scope => scope.CategoryName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var discoveredSources = new List<SyncSourceSelectionItem>();
        var discoveredCategoryScopes = new List<DiscoveredCategoryScope>();
        var duplicatePhasesSkipped = 0;
        var semaphore = new SemaphoreSlim(PhaseLookupConcurrency);

        try
        {
            var phaseLookupResults = await Task.WhenAll(categoryScopes.Select(async scope =>
            {
                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    var phases = await GetPhasesAsync(scope.CategoryId, scope.Gender, scope.Territory, cancellationToken);
                    return new PhaseLookupScope(scope, phases);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
                {
                    throw BuildScopeLookupException(
                        $"No se pudieron cargar las fases para {scope.GenderLabel} · {scope.TerritoryLabel} · {scope.CategoryName}.",
                        ex,
                        cancellationToken
                    );
                }
                finally
                {
                    semaphore.Release();
                }
            }));

            foreach (var scope in phaseLookupResults)
            {
                discoveredCategoryScopes.Add(new DiscoveredCategoryScope
                {
                    Gender = scope.Scope.Gender,
                    GenderLabel = scope.Scope.GenderLabel,
                    Territory = scope.Scope.Territory,
                    TerritoryLabel = scope.Scope.TerritoryLabel,
                    CategoryId = scope.Scope.CategoryId,
                    CategoryName = scope.Scope.CategoryName,
                    PhasesCount = scope.Phases.Count
                });

                foreach (var phase in scope.Phases)
                {
                    var normalizedPhaseId = phase.Value?.Trim() ?? "";
                    if (string.IsNullOrWhiteSpace(normalizedPhaseId))
                        continue;

                    var sourceUrl = BuildResultsUrl(normalizedPhaseId);
                    if (!seenUrls.Add(sourceUrl))
                    {
                        duplicatePhasesSkipped += 1;
                        continue;
                    }

                    discoveredSources.Add(new SyncSourceSelectionItem
                    {
                        SourceUrl = sourceUrl,
                        Label = $"{scope.Scope.GenderLabel} · {scope.Scope.TerritoryLabel} · {scope.Scope.CategoryName} · {phase.Label}"
                    });
                }
            }
        }
        finally
        {
            semaphore.Dispose();
        }

        return new DiscoverBulkSourcesResponse
        {
            Genders = normalizedGenders,
            Territories = normalizedTerritories,
            UniqueCategoryNamesCount = categoryScopes
                .Select(scope => scope.CategoryName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count(),
            CategoryScopesCount = discoveredCategoryScopes.Count,
            UniquePhasesCount = discoveredSources.Count,
            DuplicatePhasesSkipped = duplicatePhasesSkipped,
            CategoryScopes = discoveredCategoryScopes,
            Sources = discoveredSources
        };
    }

    public static string NormalizeGender(string? gender)
    {
        return string.Equals(gender, "M", StringComparison.OrdinalIgnoreCase) ? "M" : "F";
    }

    public static int NormalizeTerritory(int territory)
    {
        return territory < 0 ? 0 : territory;
    }

    public static string GetGenderLabel(string? gender)
    {
        var normalizedGender = NormalizeGender(gender);
        return GenderLabels.TryGetValue(normalizedGender, out var label)
            ? label
            : normalizedGender;
    }

    public static string GetTerritoryLabel(int territory)
    {
        var normalizedTerritory = NormalizeTerritory(territory);
        return TerritoryLabels.TryGetValue(normalizedTerritory, out var label)
            ? label
            : normalizedTerritory.ToString();
    }

    private async Task<IReadOnlyList<LookupOption>> GetOptionsAsync(string relativePath, CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxRequestAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                using var response = await _httpClient.GetAsync(relativePath, cancellationToken);
                if (IsTransientStatusCode(response.StatusCode) && attempt < MaxRequestAttempts)
                {
                    await DelayBeforeRetryAsync(attempt, cancellationToken);
                    continue;
                }

                response.EnsureSuccessStatusCode();

                var html = await response.Content.ReadAsStringAsync(cancellationToken);
                return ParseOptions(html);
            }
            catch (HttpRequestException) when (attempt < MaxRequestAttempts)
            {
                await DelayBeforeRetryAsync(attempt, cancellationToken);
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested && attempt < MaxRequestAttempts)
            {
                await DelayBeforeRetryAsync(attempt, cancellationToken);
            }
        }

        throw new HttpRequestException($"No se pudo completar la petición {relativePath} tras {MaxRequestAttempts} intentos.");
    }

    internal static IReadOnlyList<LookupOption> ParseOptions(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return [];

        var results = new List<LookupOption>();
        var seenValues = new HashSet<string>(StringComparer.Ordinal);

        foreach (Match match in OptionRegex.Matches(html))
        {
            var value = match.Groups["value"].Value.Trim();
            if (string.IsNullOrWhiteSpace(value) || value == "0" || !seenValues.Add(value))
                continue;

            var rawLabel = match.Groups["label"].Value;
            var withoutTags = Regex.Replace(rawLabel, "<.*?>", " ");
            var decodedLabel = WebUtility.HtmlDecode(withoutTags)
                .Replace('\u00A0', ' ');
            var label = Regex.Replace(decodedLabel, "\\s+", " ").Trim();

            if (string.IsNullOrWhiteSpace(label))
                continue;

            results.Add(new LookupOption
            {
                Value = value,
                Label = label
            });
        }

        return results;
    }

    private static int ParseLookupValue(string? value)
    {
        return int.TryParse(value, out var parsedValue) ? parsedValue : 0;
    }

    private static bool IsTransientStatusCode(HttpStatusCode statusCode)
    {
        var numericStatusCode = (int)statusCode;
        return statusCode == HttpStatusCode.RequestTimeout
               || statusCode == (HttpStatusCode)429
               || numericStatusCode >= 500;
    }

    private static async Task DelayBeforeRetryAsync(int attempt, CancellationToken cancellationToken)
    {
        var exponentialFactor = Math.Pow(2, Math.Max(0, attempt - 1));
        var jitterMilliseconds = Random.Shared.Next(80, 220);
        var delay = TimeSpan.FromMilliseconds((BaseRetryDelay.TotalMilliseconds * exponentialFactor) + jitterMilliseconds);
        await Task.Delay(delay, cancellationToken);
    }

    private static Exception BuildScopeLookupException(string message, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is TaskCanceledException && cancellationToken.IsCancellationRequested)
        {
            return exception;
        }

        return exception switch
        {
            HttpRequestException httpRequestException => new HttpRequestException($"{message} {httpRequestException.Message}", httpRequestException),
            TaskCanceledException taskCanceledException => new HttpRequestException($"{message} La petición agotó el tiempo de espera.", taskCanceledException),
            _ => new HttpRequestException(message, exception)
        };
    }

    private static string BuildResultsUrl(string phaseId)
    {
        return $"https://www.basquetcatala.cat/competicions/resultats/{phaseId}/0";
    }

    private sealed record CategoryLookupScope(string Gender, int Territory, IReadOnlyList<LookupOption> Categories);

    private sealed record DiscoveredCategoryScopeState(
        string Gender,
        string GenderLabel,
        int Territory,
        string TerritoryLabel,
        int CategoryId,
        string CategoryName
    );

    private sealed record PhaseLookupScope(
        DiscoveredCategoryScopeState Scope,
        IReadOnlyList<LookupOption> Phases
    );
}
