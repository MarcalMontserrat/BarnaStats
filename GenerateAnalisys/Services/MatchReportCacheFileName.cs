namespace GenerateAnalisys.Services;

public static class MatchReportCacheFileName
{
    public static string Build(int matchWebId, int? focusTeamIdExtern = null)
    {
        return focusTeamIdExtern is > 0
            ? $"{matchWebId}__team-{focusTeamIdExtern.Value}.json"
            : $"{matchWebId}.json";
    }
}
