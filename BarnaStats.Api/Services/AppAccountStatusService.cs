using System.Text.Json;
using BarnaStats.Services;
using BarnaStats.Utilities;

namespace BarnaStats.Api.Services;

// Estado de la cuenta de la app para la pestaña "Cargar fase": si está configurada y cuántos partidos
// se han descargado con ella. Nunca devuelve credenciales.
public sealed class AppAccountStatusService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly BarnaStatsPaths _paths;

    public AppAccountStatusService(BarnaStatsPaths paths)
    {
        _paths = paths;
    }

    public AppAccountStatus GetStatus()
    {
        var settings = AppAccountSettings.Resolve(_paths.OutputDir);
        var token = MsStatsTokenStore.LoadValid(_paths.FcbqAppTokenFile);

        return new AppAccountStatus(
            settings.IsConfigured,
            settings.HasPassword,
            settings.MissingFields,
            settings.Source,
            settings.SettingsFile,
            settings.Error,
            token is null ? null : MsStatsTokenStore.TryGetExpiration(token),
            CountAppMatches());
    }

    public string DescribeForJobLog()
    {
        var status = GetStatus();
        var account = status.Configured
            ? $"configurada ({status.Source})"
            : $"no configurada{(status.MissingFields.Count > 0 ? $": falta {string.Join(", ", status.MissingFields)}" : "")}";
        return $"Cuenta de la app: {account}. Partidos descargados con la cuenta: {status.AppMatches}.";
    }

    private int CountAppMatches()
    {
        if (!Directory.Exists(_paths.PhasesDir))
            return 0;

        var count = 0;
        foreach (var mappingFile in Directory.EnumerateFiles(_paths.PhasesDir, "match_mapping.json", SearchOption.AllDirectories))
        {
            try
            {
                var mappings = JsonSerializer.Deserialize<List<MappingSourceEntry>>(File.ReadAllText(mappingFile), JsonOptions) ?? [];
                count += mappings.Count(mapping => string.Equals(mapping.StatsSource, "app", StringComparison.OrdinalIgnoreCase));
            }
            catch (Exception ex) when (ex is JsonException or IOException)
            {
                // Un mapping ilegible no debe tumbar el estado.
            }
        }

        return count;
    }

    private sealed class MappingSourceEntry
    {
        public string? StatsSource { get; set; }
    }
}

public sealed record AppAccountStatus(
    bool Configured,
    bool PasswordConfigured,
    IReadOnlyList<string> MissingFields,
    string? Source,
    string SettingsFile,
    string? Error,
    DateTimeOffset? TokenExpiresAtUtc,
    int AppMatches);
