namespace BarnaStats.Utilities;

public enum StorageScopeKind
{
    Root,
    Team,
    Phase
}

public sealed class StorageScope
{
    private StorageScope(StorageScopeKind kind, int? id)
    {
        Kind = kind;
        Id = id;
    }

    public StorageScopeKind Kind { get; }
    public int? Id { get; }

    public static StorageScope Root() => new(StorageScopeKind.Root, null);
    public static StorageScope Team(int teamCalendarId) => new(StorageScopeKind.Team, teamCalendarId);
    public static StorageScope Phase(int phaseId) => new(StorageScopeKind.Phase, phaseId);

    public override string ToString()
    {
        return Kind switch
        {
            StorageScopeKind.Team => $"team:{Id}",
            StorageScopeKind.Phase => $"phase:{Id}",
            _ => "root"
        };
    }
}
