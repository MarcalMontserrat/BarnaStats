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
    public string HomeTeamKey { get; set; } = "";
    public string AwayTeamKey { get; set; } = "";
    public int MatchWebId { get; set; }
    public int MatchInternId { get; set; }
    public int MatchExternId { get; set; }
    public DateTime? MatchDate { get; set; }
    public int PhaseNumber { get; set; }
    public int? SourcePhaseId { get; set; }
    public string CategoryName { get; set; } = "";
    public string PhaseName { get; set; } = "";
    public string LevelName { get; set; } = "";
    public string LevelCode { get; set; } = "";
    public string GroupCode { get; set; } = "";
    public int PhaseRound { get; set; }
    public int RoundNumber { get; set; }
    public string HomeTeam { get; set; } = "";
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public string AwayTeam { get; set; } = "";
    public bool IsHome { get; set; }
    public string RivalTeamKey { get; set; } = "";
    public string RivalTeam { get; set; } = "";
    public int OfficialTeamScore { get; set; }
    public int OfficialRivalScore { get; set; }
    public int TeamScore { get; set; }
    public int RivalScore { get; set; }
    public string Result { get; set; } = "";
    public string TopScorer { get; set; } = "";
    public string TopScorerTeam { get; set; } = "";
    public int TopScorerPoints { get; set; }
    public string TeamTopScorer { get; set; } = "";
    public int TeamTopScorerPoints { get; set; }
    public MatchInsights? Insights { get; set; }
    public string MatchReport { get; set; } = "";
    public DateTime? MatchReportGeneratedAtUtc { get; set; }
    public string MatchReportModel { get; set; } = "";
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
    public int? SourcePhaseId { get; set; }
    public string CategoryName { get; set; } = "";
    public string PhaseName { get; set; } = "";
    public string LevelName { get; set; } = "";
    public string LevelCode { get; set; } = "";
    public string GroupCode { get; set; } = "";
    public int PhaseRound { get; set; }
    public bool IsHome { get; set; }
    public string RivalTeamKey { get; set; } = "";
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

public sealed class MatchPeriodScore
{
    public int PeriodNumber { get; set; }
    public string Label { get; set; } = "";
    public int TeamPoints { get; set; }
    public int RivalPoints { get; set; }
    public int Diff { get; set; }
}

public sealed class MatchInsights
{
    public int LeadChanges { get; set; }
    public int Ties { get; set; }
    public int MaxLead { get; set; }
    public int MaxDeficit { get; set; }
    public int BestRun { get; set; }
    public int RivalBestRun { get; set; }
    public int ClosingRun { get; set; }
    public int RivalClosingRun { get; set; }
    public string FirstScorer { get; set; } = "";
    public string FirstScorerTeam { get; set; } = "";
    public string LastScorer { get; set; } = "";
    public string LastScorerTeam { get; set; } = "";
    public string TeamFirstScorer { get; set; } = "";
    public string TeamLastScorer { get; set; } = "";
    public string BestPeriodLabel { get; set; } = "";
    public int BestPeriodDiff { get; set; }
    public string WorstPeriodLabel { get; set; } = "";
    public int WorstPeriodDiff { get; set; }
    public List<MatchPeriodScore> PeriodScores { get; set; } = [];
}

public sealed class CompetitionPhase
{
    public int? SourcePhaseId { get; init; }
    public int PhaseNumber { get; init; }
    public string CategoryName { get; init; } = "";
    public string PhaseName { get; init; } = "";
    public string LevelName { get; init; } = "";
    public string LevelCode { get; init; } = "";
    public string GroupCode { get; init; } = "";
    public int MatchesCount { get; init; }
}

public sealed class CompetitionTeamOverview
{
    public string TeamKey { get; init; } = "";
    public int TeamIdIntern { get; init; }
    public int TeamIdExtern { get; init; }
    public string TeamName { get; init; } = "";
    public int MatchesPlayed { get; init; }
    public int PlayersCount { get; init; }
}

public sealed class CompetitionMatch
{
    public int MatchWebId { get; init; }
    public int MatchInternId { get; init; }
    public int MatchExternId { get; init; }
    public DateTime? MatchDate { get; init; }
    public int PhaseNumber { get; init; }
    public int? SourcePhaseId { get; init; }
    public string CategoryName { get; init; } = "";
    public string PhaseName { get; init; } = "";
    public string LevelName { get; init; } = "";
    public string LevelCode { get; init; } = "";
    public string GroupCode { get; init; } = "";
    public string HomeTeamKey { get; init; } = "";
    public string HomeTeam { get; init; } = "";
    public int HomeScore { get; init; }
    public string AwayTeamKey { get; init; } = "";
    public string AwayTeam { get; init; } = "";
    public int AwayScore { get; init; }
    public string TopScorer { get; init; } = "";
    public string TopScorerTeam { get; init; } = "";
    public int TopScorerPoints { get; init; }
}

public sealed class CompetitionStandingRow
{
    public int Position { get; init; }
    public string TeamKey { get; init; } = "";
    public string TeamName { get; init; } = "";
    public int Played { get; init; }
    public int Wins { get; init; }
    public int Losses { get; init; }
    public int Ties { get; init; }
    public int PointsFor { get; init; }
    public int PointsAgainst { get; init; }
    public int PointDiff { get; init; }
}

public sealed class TeamPhaseInfo
{
    public int PhaseNumber { get; init; }
    public int? SourcePhaseId { get; init; }
    public string CategoryName { get; init; } = "";
    public string PhaseName { get; init; } = "";
    public string LevelName { get; init; } = "";
    public string LevelCode { get; init; } = "";
    public string GroupCode { get; init; } = "";
    public int MatchesPlayed { get; init; }
}

public sealed class CompetitionPhaseStandings
{
    public int PhaseNumber { get; init; }
    public List<CompetitionStandingRow> Rows { get; init; } = [];
}

public sealed class CompetitionPlayerLeader
{
    public string Key { get; init; } = "";
    public string TeamKey { get; init; } = "";
    public int TeamIdIntern { get; init; }
    public int TeamIdExtern { get; init; }
    public string TeamName { get; init; } = "";
    public long PlayerActorId { get; init; }
    public string PlayerName { get; init; } = "";
    public string ShirtNumber { get; init; } = "";
    public int Games { get; init; }
    public int Minutes { get; init; }
    public int Points { get; init; }
    public double AvgPoints { get; init; }
    public int Valuation { get; init; }
    public double AvgValuation { get; init; }
}

public sealed class CompetitionAnalysis
{
    public int TotalTeams { get; init; }
    public int TotalMatches { get; init; }
    public List<CompetitionPhase> Phases { get; init; } = [];
    public List<CompetitionTeamOverview> Teams { get; init; } = [];
    public List<CompetitionMatch> Matches { get; init; } = [];
    public List<CompetitionPhaseStandings> StandingsByPhase { get; init; } = [];
    public List<CompetitionPlayerLeader> PlayerLeaders { get; init; } = [];
}

public sealed class TeamAnalysis
{
    public string TeamKey { get; init; } = "";
    public int TeamIdIntern { get; init; }
    public int TeamIdExtern { get; init; }
    public string TeamName { get; init; } = "";
    public int MatchesPlayed { get; init; }
    public int PlayersCount { get; init; }
    public List<TeamPhaseInfo> Phases { get; init; } = [];
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
    public CompetitionAnalysis Competition { get; init; } = new();
    public List<TeamAnalysis> Teams { get; init; } = [];
}

public sealed class AnalysisIndexTeam
{
    public string TeamKey { get; init; } = "";
    public int TeamIdIntern { get; init; }
    public int TeamIdExtern { get; init; }
    public string TeamName { get; init; } = "";
    public int MatchesPlayed { get; init; }
    public int PlayersCount { get; init; }
    public string DataFile { get; init; } = "";
    public List<TeamPhaseInfo> Phases { get; init; } = [];
}

public sealed class AnalysisIndex
{
    public DateTime GeneratedAtUtc { get; init; }
    public int TotalMatches { get; init; }
    public int TotalTeams { get; init; }
    public List<AnalysisIndexTeam> Teams { get; init; } = [];
}
