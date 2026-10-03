using BarnaStats.Models;
using Microsoft.Playwright;

namespace BarnaStats.Services;

public sealed class PersistentBrowserMappingSyncRunner : IMatchMappingSyncRunner, IAsyncDisposable
{
    private readonly MatchMappingSyncService _syncService;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private IPlaywright? _playwright;
    private IBrowserContext? _browserContext;
    private volatile bool _browserContextClosed;
    private bool _disposed;

    public PersistentBrowserMappingSyncRunner(string browserProfileDir, string? msStatsTokenFile = null)
    {
        _syncService = new MatchMappingSyncService(browserProfileDir, msStatsTokenFile);
    }

    public async Task<MatchMappingSyncResult> SyncAsync(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        bool includeAll,
        string? sourceUrl = null,
        bool interactive = true,
        Action<string>? log = null)
    {
        await _semaphore.WaitAsync();

        try
        {
            ThrowIfDisposed();
            await EnsureBrowserContextAsync();

            try
            {
                return await RunSyncAsync(existingMappings, explicitMatchWebIds, includeAll, sourceUrl, interactive, log);
            }
            catch (PlaywrightException ex) when (IsClosedTargetError(ex))
            {
                // El navegador se cerró entre syncs (ventana cerrada a mano o caída): se relanza y se reintenta una vez.
                Console.WriteLine("El navegador persistente estaba cerrado. Se vuelve a abrir y se reintenta.");
                await ResetBrowserContextAsync();
                await EnsureBrowserContextAsync();
                return await RunSyncAsync(existingMappings, explicitMatchWebIds, includeAll, sourceUrl, interactive, log);
            }
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private Task<MatchMappingSyncResult> RunSyncAsync(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        bool includeAll,
        string? sourceUrl,
        bool interactive,
        Action<string>? log)
    {
        return _syncService.SyncWithBrowserContextAsync(
            _browserContext!,
            existingMappings,
            explicitMatchWebIds,
            includeAll,
            sourceUrl,
            interactive,
            log);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
            return;

        await _semaphore.WaitAsync();

        try
        {
            if (_disposed)
                return;

            _disposed = true;

            if (_browserContext is not null)
            {
                await _browserContext.CloseAsync();
                _browserContext = null;
            }

            _playwright?.Dispose();
            _playwright = null;
        }
        finally
        {
            _semaphore.Release();
            _semaphore.Dispose();
        }
    }

    private async Task EnsureBrowserContextAsync()
    {
        if (_browserContext is not null && !_browserContextClosed)
            return;

        await ResetBrowserContextAsync();
        _playwright = await Playwright.CreateAsync();

        try
        {
            var browserContext = await _syncService.LaunchContextAsync(_playwright, headless: false);
            _browserContextClosed = false;
            browserContext.Close += (_, _) => _browserContextClosed = true;
            _browserContext = browserContext;

            if (_browserContext.Pages.Count == 0)
                await _browserContext.NewPageAsync();
        }
        catch
        {
            _playwright.Dispose();
            _playwright = null;
            throw;
        }
    }

    private async Task ResetBrowserContextAsync()
    {
        if (_browserContext is not null)
        {
            try
            {
                await _browserContext.CloseAsync();
            }
            catch (PlaywrightException)
            {
                // Ya estaba cerrado.
            }

            _browserContext = null;
        }

        _playwright?.Dispose();
        _playwright = null;
    }

    private static bool IsClosedTargetError(PlaywrightException ex)
    {
        // Los dos síntomas vistos cuando el navegador de la sync se cierra o queda colgado.
        return ex.Message.Contains("has been closed", StringComparison.OrdinalIgnoreCase) ||
               ex.Message.Contains("Failed to open a new tab", StringComparison.OrdinalIgnoreCase);
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(PersistentBrowserMappingSyncRunner));
    }
}
