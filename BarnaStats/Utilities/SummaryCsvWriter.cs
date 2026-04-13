using System.Text;
using BarnaStats.Models;

namespace BarnaStats.Utilities;

public static class SummaryCsvWriter
{
    public static async Task WriteAsync(string path, IReadOnlyCollection<SummaryRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("matchWebId,uuidMatch,status,homeTeam,homeScore,awayScore,awayTeam,hasStats,hasMoves,error");

        foreach (var row in rows.OrderBy(x => x.MatchWebId))
        {
            sb.AppendLine(string.Join(",",
                CsvHelper.Escape(row.MatchWebId.ToString()),
                CsvHelper.Escape(row.UuidMatch),
                CsvHelper.Escape(row.Status),
                CsvHelper.Escape(row.HomeTeam),
                CsvHelper.Escape(row.HomeScore?.ToString() ?? ""),
                CsvHelper.Escape(row.AwayScore?.ToString() ?? ""),
                CsvHelper.Escape(row.AwayTeam),
                CsvHelper.Escape(row.HasStats.ToString()),
                CsvHelper.Escape(row.HasMoves.ToString()),
                CsvHelper.Escape(row.Error)
            ));
        }

        await File.WriteAllTextAsync(path, sb.ToString(), Encoding.UTF8);
    }
}
