using BarnaStats.Api.Endpoints;
using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Services;
using BarnaStats.Services;
using BarnaStats.Utilities;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:5071");

var repoPaths = RepoPaths.ResolveDefault();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                    return false;

                return uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                       uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton(repoPaths);
builder.Services.AddSingleton(_ =>
{
    var paths = BarnaStatsPaths.CreateFromProjectDir(repoPaths.BarnaStatsProjectDir);
    paths.EnsureDirectories();
    return paths;
});
builder.Services.AddSingleton<PersistentBrowserMappingSyncRunner>(provider =>
{
    var paths = provider.GetRequiredService<BarnaStatsPaths>();
    return new PersistentBrowserMappingSyncRunner(paths.BrowserProfileDir);
});
builder.Services.AddSingleton<MappingSynchronizationCoordinator>(provider =>
{
    var paths = provider.GetRequiredService<BarnaStatsPaths>();
    var runner = provider.GetRequiredService<PersistentBrowserMappingSyncRunner>();
    return new MappingSynchronizationCoordinator(paths, runner);
});
builder.Services.AddSingleton<SyncOrchestrator>();
builder.Services.AddSingleton<ResultsSourceCatalogService>();
builder.Services.AddSingleton<MatchAiReportService>();
builder.Services.AddHttpClient<BasquetCatalaLookupService>(client =>
{
    client.BaseAddress = new Uri("https://www.basquetcatala.cat/");
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("BarnaStats/1.0");
});

var app = builder.Build();

app.UseCors();

app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next();
});

app.MapHealthEndpoints();
app.MapSyncEndpoints();
app.MapMatchEndpoints();
app.MapBasquetCatalaEndpoints();

app.Run();
