using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Utilities;

namespace BarnaStats.Services;

// Cuando empieza una temporada nueva, basquetcatala sustituye los partidos de la anterior por "descanso".
// Reimportar entonces una fase ya descargada de una temporada pasada sobrescribiría sus datos con vacíos,
// así que esas fases quedan bloqueadas. Las fases sin datos locales no se bloquean: no hay nada que perder.
public static class PastSeasonImportGuard
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    // Mismo corte que GenerateAnalisys: de julio en adelante cuenta como temporada nueva.
    public static int GetSeasonStartYear(DateTime date)
    {
        return date.Month >= 7 ? date.Year : date.Year - 1;
    }

    public static string FormatSeasonLabel(int seasonStartYear)
    {
        return $"{seasonStartYear}-{seasonStartYear + 1}";
    }

    public static async Task<int?> ResolveStoredSeasonStartYearAsync(TeamStoragePaths storage)
    {
        if (File.Exists(storage.PhaseMetadataFile))
        {
            try
            {
                var metadata = JsonSerializer.Deserialize<PhaseMetadata>(
                    await File.ReadAllTextAsync(storage.PhaseMetadataFile),
                    JsonOptions);

                if (metadata?.SeasonStartYear is > 0)
                    return metadata.SeasonStartYear;
            }
            catch (JsonException)
            {
                // Metadata corrupta: se intenta con las fechas del mapping.
            }
        }

        if (!File.Exists(storage.MappingFile))
            return null;

        try
        {
            var mappings = JsonSerializer.Deserialize<List<MatchMapping>>(
                await File.ReadAllTextAsync(storage.MappingFile),
                JsonOptions) ?? [];

            var latestMatchDate = mappings
                .Where(mapping => mapping.MatchDate.HasValue)
                .Select(mapping => mapping.MatchDate!.Value)
                .DefaultIfEmpty()
                .Max();

            return latestMatchDate == default ? null : GetSeasonStartYear(latestMatchDate);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // Devuelve el motivo del bloqueo, o null si la fase se puede importar.
    public static async Task<string?> GetBlockReasonAsync(TeamStoragePaths storage, DateTime now)
    {
        var storedSeasonStartYear = await ResolveStoredSeasonStartYearAsync(storage);
        var currentSeasonStartYear = GetSeasonStartYear(now);

        if (storedSeasonStartYear is null || storedSeasonStartYear >= currentSeasonStartYear)
            return null;

        return $"La fase es de la temporada {FormatSeasonLabel(storedSeasonStartYear.Value)} y la actual es " +
               $"{FormatSeasonLabel(currentSeasonStartYear)}. La fuente ya no publica sus partidos (salen como descanso), " +
               "así que reimportarla borraría los datos guardados. Se bloquea la importación.";
    }
}
