namespace BarnaStats.Models;

public sealed class MatchMapping
{
    public int MatchWebId { get; set; }
    public string? UuidMatch { get; set; }
    public DateTime? MatchDate { get; set; }
    // Ids de `/equip/{id}` de la página de resultados. Las stats desde 2026-2027 solo traen uuids de equipo,
    // y la web identifica a los equipos por este id.
    public int? LocalTeamIdExtern { get; set; }
    public int? VisitorTeamIdExtern { get; set; }
    // "app" si las stats se descargaron con la cuenta de la app (no se publican salvo que se pida); null si son públicas.
    public string? StatsSource { get; set; }

    public void ApplyTeamIdExterns(MatchDiscovery discovery)
    {
        if (discovery.LocalTeamIdExtern is > 0)
            LocalTeamIdExtern = discovery.LocalTeamIdExtern;

        if (discovery.VisitorTeamIdExtern is > 0)
            VisitorTeamIdExtern = discovery.VisitorTeamIdExtern;
    }
}
