using System.Text.Json;
using GenerateAnalisys.Models;
using Xunit.Sdk;

namespace GenerateAnalisys.Tests;

public sealed class StatsContractsTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public void Stats_fixture_keeps_the_expected_shape()
    {
        var statsPath = Path.Combine(
            FixturePaths.SinglePhaseRoot,
            "stats",
            "34951_68fcb7c91497f200013e2648_stats.json");

        var stats = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(statsPath), JsonOptions);

        Assert.NotNull(stats);
        Assert.Equal(2, stats.Teams.Count);
        Assert.Equal("Oct 25, 2025 2:00:00 PM", stats.Time);
        Assert.Contains(stats.Teams, team => team.TeamIdIntern == stats.LocalId);
        Assert.Contains(stats.Teams, team => team.TeamIdIntern == stats.VisitId);

        var localTeam = stats.Teams.Single(team => team.TeamIdIntern == stats.LocalId);
        var visitTeam = stats.Teams.Single(team => team.TeamIdIntern == stats.VisitId);

        Assert.Equal("BASQUET ATENEU MONTSERRAT GROC", localTeam.Name);
        Assert.Equal("CB MANYANET LES CORTS GROC", visitTeam.Name);
        Assert.Equal(10, localTeam.Players.Count);
        Assert.Equal(12, visitTeam.Players.Count);
        Assert.Equal(12, localTeam.Data?.Score);
        Assert.Equal(18, visitTeam.Data?.Score);
        Assert.Equal("LUCIA ALZAMORA SANTA CRUZ", localTeam.Players[0].Name);
        Assert.Equal("1", localTeam.Players[0].Dorsal);
    }

    [Fact]
    public void Moves_fixture_keeps_the_expected_shape()
    {
        var movesPath = Path.Combine(
            FixturePaths.SinglePhaseRoot,
            "moves",
            "34951_68fcb7c91497f200013e2648_moves.json");

        var moves = JsonSerializer.Deserialize<List<MoveEvent>>(File.ReadAllText(movesPath), JsonOptions);

        Assert.NotNull(moves);
        Assert.Equal(202, moves.Count);
        Assert.Equal("Surt del camp", moves[0].Move);
        Assert.Equal("Final de període", moves[^1].Move);
        Assert.Contains(moves, move => string.Equals(move.Move, "Cistella de 2", StringComparison.Ordinal));
    }

    [Fact]
    public void Phase_metadata_fixture_keeps_the_expected_shape()
    {
        var metadataPath = Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json");
        var metadata = JsonSerializer.Deserialize<PhaseMetadataFile>(File.ReadAllText(metadataPath), JsonOptions);

        Assert.NotNull(metadata);
        Assert.Equal(20856, metadata.PhaseId);
        Assert.Equal("C.t. Pre-mini Femení 1r. Any", metadata.CategoryName);
        Assert.Equal("Primera Fase", metadata.PhaseName);
        Assert.Equal("Nivell B/c", metadata.LevelName);
        Assert.Equal("B/c", metadata.LevelCode);
        Assert.Equal("04", metadata.GroupCode);
    }

    [Fact]
    public void Current_raw_data_can_still_be_deserialized_when_present_locally()
    {
        var outDir = Path.Combine(FixturePaths.RepoRoot, "BarnaStats", "out");
        if (!Directory.Exists(outDir))
        {
            return;
        }

        foreach (var statsPath in Directory.EnumerateFiles(outDir, "*_stats.json", SearchOption.AllDirectories))
        {
            var stats = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(statsPath), JsonOptions);

            if (stats is null)
            {
                throw new XunitException($"No se ha podido deserializar `{statsPath}`.");
            }

            if (stats.Teams.Count < 2)
            {
                throw new XunitException($"`{statsPath}` no contiene dos equipos válidos.");
            }
        }

        foreach (var movesPath in Directory.EnumerateFiles(outDir, "*_moves.json", SearchOption.AllDirectories))
        {
            var moves = JsonSerializer.Deserialize<List<MoveEvent>>(File.ReadAllText(movesPath), JsonOptions);

            if (moves is null)
            {
                throw new XunitException($"No se ha podido deserializar `{movesPath}`.");
            }
        }

        foreach (var metadataPath in Directory.EnumerateFiles(outDir, "phase_metadata.json", SearchOption.AllDirectories))
        {
            var metadata = JsonSerializer.Deserialize<PhaseMetadataFile>(File.ReadAllText(metadataPath), JsonOptions);

            if (metadata is null)
            {
                throw new XunitException($"No se ha podido deserializar `{metadataPath}`.");
            }

            if (string.IsNullOrWhiteSpace(metadata.PhaseName) ||
                string.IsNullOrWhiteSpace(metadata.LevelName))
            {
                throw new XunitException($"`{metadataPath}` no contiene la metadata mínima esperada.");
            }
        }
    }
}
