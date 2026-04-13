namespace GenerateAnalisys.Models;

public sealed class PlayerSeasonTotal
{
    public string TeamKey { get; set; } = "";
    public int TeamIdIntern { get; set; }
    public int TeamIdExtern { get; set; }
    public string TeamName { get; set; } = "";
    public long PlayerActorId { get; set; }
    public string PlayerName { get; set; } = "";
    public string ShirtNumber { get; set; } = "";
    public int Games { get; set; }
    public int Minutes { get; set; }
    public int Points { get; set; }
    public int Valuation { get; set; }
    public int Fouls { get; set; }
    public int PlusMinus { get; set; }
    public int FtMade { get; set; }
    public int FtAttempted { get; set; }
    public int TwoMade { get; set; }
    public int TwoAttempted { get; set; }
    public int ThreeMade { get; set; }
    public int ThreeAttempted { get; set; }
}

public sealed class MatchSummary
{
    public string TeamKey { get; set; } = "";
    public int TeamIdIntern { get; set; }
    public int TeamIdExtern { get; set; }
    public string TeamName { get; set; } = "";
    public int MatchWebId { get; set; }
    public int MatchInternId { get; set; }
    public int MatchExternId { get; set; }
    public DateTime? MatchDate { get; set; }
    public int PhaseNumber { get; set; }
    public int PhaseRound { get; set; }
    public int RoundNumber { get; set; }
    public string HomeTeam { get; set; } = "";
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public string AwayTeam { get; set; } = "";
    public bool IsHome { get; set; }
    public string RivalTeam { get; set; } = "";
    public int TeamScore { get; set; }
    public int RivalScore { get; set; }
    public string Result { get; set; } = "";
    public string TopScorer { get; set; } = "";
    public string TopScorerTeam { get; set; } = "";
    public int TopScorerPoints { get; set; }
    public string TeamTopScorer { get; set; } = "";
    public int TeamTopScorerPoints { get; set; }
}

public sealed class MatchPlayerRow
{
    public string TeamKey { get; set; } = "";
    public int TeamIdIntern { get; set; }
    public int TeamIdExtern { get; set; }
    public string TeamName { get; set; } = "";
    public int MatchWebId { get; set; }
    public int MatchInternId { get; set; }
    public int MatchExternId { get; set; }
    public DateTime? MatchDate { get; set; }
    public int PhaseNumber { get; set; }
    public int PhaseRound { get; set; }
    public bool IsHome { get; set; }
    public string Rival { get; set; } = "";
    public long PlayerActorId { get; set; }
    public string PlayerName { get; set; } = "";
    public string Dorsal { get; set; } = "";
    public int Minutes { get; set; }
    public int Points { get; set; }
    public int Valuation { get; set; }
    public int Fouls { get; set; }
    public int PlusMinus { get; set; }
}

public sealed class MatchMVP
{
    public int MatchWebId { get; set; }
    public long PlayerActorId { get; set; }
    public string PlayerName { get; set; } = "";
    public int Points { get; set; }
    public int Valuation { get; set; }
    public int Minutes { get; set; }
}

public sealed class PlayerRanking
{
    public long PlayerActorId { get; set; }
    public string PlayerName { get; set; } = "";
    public string Dorsal { get; set; } = "";
    public int Games { get; set; }
    public int Points { get; set; }
    public double AvgPoints { get; set; }
    public int Valuation { get; set; }
    public double AvgValuation { get; set; }
    public int Minutes { get; set; }
}

public sealed class PlayerEvolution
{
    public long PlayerActorId { get; set; }
    public string PlayerName { get; set; } = "";
    public int PhaseNumber { get; set; }
    public int PhaseRound { get; set; }
    public int MatchNumber { get; set; }
    public int MatchWebId { get; set; }
    public int Points { get; set; }
    public int Valuation { get; set; }
}

public sealed class TeamAnalysis
{
    public string TeamKey { get; init; } = "";
    public int TeamIdIntern { get; init; }
    public int TeamIdExtern { get; init; }
    public string TeamName { get; init; } = "";
    public int MatchesPlayed { get; init; }
    public int PlayersCount { get; init; }
    public List<MatchSummary> MatchSummaries { get; init; } = [];
    public List<MatchPlayerRow> MatchPlayers { get; init; } = [];
    public List<PlayerSeasonTotal> SeasonTotals { get; init; } = [];
    public List<MatchMVP> MatchMVPs { get; init; } = [];
    public List<PlayerRanking> Ranking { get; init; } = [];
    public List<PlayerEvolution> Evolution { get; init; } = [];
}

public sealed class AnalysisResult
{
    public DateTime GeneratedAtUtc { get; init; }
    public int TotalMatches { get; init; }
    public List<TeamAnalysis> Teams { get; init; } = [];
}
