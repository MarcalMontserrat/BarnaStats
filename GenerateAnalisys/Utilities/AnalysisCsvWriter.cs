using System.Globalization;
using System.Text;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Utilities;

public static class AnalysisCsvWriter
{
    public static async Task WriteRankingCsvAsync(string path, IReadOnlyCollection<PlayerRanking> rows)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var sb = new StringBuilder();
        sb.AppendLine("playerName,dorsal,games,points,avgPoints,valuation,avgValuation,minutes");

        foreach (var row in rows)
        {
            sb.AppendLine(string.Join(",",
                CsvHelper.Escape(row.PlayerName),
                CsvHelper.Escape(row.Dorsal),
                row.Games,
                row.Points,
                row.AvgPoints.ToString("0.00", CultureInfo.InvariantCulture),
                row.Valuation,
                row.AvgValuation.ToString("0.00", CultureInfo.InvariantCulture),
                row.Minutes
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString());
    }

    public static async Task WriteMvpCsvAsync(string path, IReadOnlyCollection<MatchMVP> rows)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var sb = new StringBuilder();
        sb.AppendLine("matchWebId,playerName,points,valuation,minutes");

        foreach (var row in rows.OrderBy(x => x.MatchWebId))
        {
            sb.AppendLine(string.Join(",",
                row.MatchWebId,
                CsvHelper.Escape(row.PlayerName),
                row.Points,
                row.Valuation,
                row.Minutes
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString());
    }

    public static async Task WriteMatchPlayersCsvAsync(string path, IReadOnlyCollection<MatchPlayerRow> rows)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var sb = new StringBuilder();
        sb.AppendLine("matchWebId,rival,playerName,dorsal,minutes,points,valuation,fouls,plusMinus");

        foreach (var row in rows
                     .OrderBy(x => x.MatchWebId)
                     .ThenByDescending(x => x.Points))
        {
            sb.AppendLine(string.Join(",",
                CsvHelper.Escape(row.MatchWebId.ToString()),
                CsvHelper.Escape(row.Rival),
                CsvHelper.Escape(row.PlayerName),
                CsvHelper.Escape(row.Dorsal),
                CsvHelper.Escape(row.Minutes.ToString()),
                CsvHelper.Escape(row.Points.ToString()),
                CsvHelper.Escape(row.Valuation.ToString()),
                CsvHelper.Escape(row.Fouls.ToString()),
                CsvHelper.Escape(row.PlusMinus.ToString())
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString(), Encoding.UTF8);
    }

    public static async Task WriteMatchSummariesCsvAsync(string path, IReadOnlyCollection<MatchSummary> rows)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var sb = new StringBuilder();
        sb.AppendLine("matchWebId,matchInternId,matchExternId,homeTeam,homeScore,awayScore,awayTeam,topScorer,topScorerTeam,topScorerPoints");

        foreach (var row in rows.OrderBy(x => x.MatchWebId))
        {
            sb.AppendLine(string.Join(",",
                CsvHelper.Escape(row.MatchWebId.ToString()),
                CsvHelper.Escape(row.MatchInternId.ToString()),
                CsvHelper.Escape(row.MatchExternId.ToString()),
                CsvHelper.Escape(row.HomeTeam),
                CsvHelper.Escape(row.HomeScore.ToString()),
                CsvHelper.Escape(row.AwayScore.ToString()),
                CsvHelper.Escape(row.AwayTeam),
                CsvHelper.Escape(row.TopScorer),
                CsvHelper.Escape(row.TopScorerTeam),
                CsvHelper.Escape(row.TopScorerPoints.ToString())
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString(), Encoding.UTF8);
    }

    public static async Task WriteSeasonPlayersCsvAsync(string path, IEnumerable<PlayerSeasonTotal> rows)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var sb = new StringBuilder();
        sb.AppendLine("teamIdIntern,teamIdExtern,teamName,playerActorId,playerName,shirtNumber,games,minutes,points,valuation,fouls,plusMinus,ftMade,ftAttempted,twoMade,twoAttempted,threeMade,threeAttempted");

        foreach (var row in rows
                     .OrderBy(x => x.TeamName, StringComparer.OrdinalIgnoreCase)
                     .ThenByDescending(x => x.Points)
                     .ThenBy(x => x.PlayerName, StringComparer.OrdinalIgnoreCase))
        {
            sb.AppendLine(string.Join(",",
                CsvHelper.Escape(row.TeamIdIntern.ToString()),
                CsvHelper.Escape(row.TeamIdExtern.ToString()),
                CsvHelper.Escape(row.TeamName),
                CsvHelper.Escape(row.PlayerActorId.ToString()),
                CsvHelper.Escape(row.PlayerName),
                CsvHelper.Escape(row.ShirtNumber),
                CsvHelper.Escape(row.Games.ToString()),
                CsvHelper.Escape(row.Minutes.ToString()),
                CsvHelper.Escape(row.Points.ToString()),
                CsvHelper.Escape(row.Valuation.ToString()),
                CsvHelper.Escape(row.Fouls.ToString()),
                CsvHelper.Escape(row.PlusMinus.ToString()),
                CsvHelper.Escape(row.FtMade.ToString()),
                CsvHelper.Escape(row.FtAttempted.ToString()),
                CsvHelper.Escape(row.TwoMade.ToString()),
                CsvHelper.Escape(row.TwoAttempted.ToString()),
                CsvHelper.Escape(row.ThreeMade.ToString()),
                CsvHelper.Escape(row.ThreeAttempted.ToString())
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString(), Encoding.UTF8);
    }
}
