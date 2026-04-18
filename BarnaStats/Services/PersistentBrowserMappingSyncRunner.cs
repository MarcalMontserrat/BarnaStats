using BarnaStats.Models;
using Microsoft.Playwright;

namespace BarnaStats.Services;

public sealed class PersistentBrowserMappingSyncRunner : IMatchMappingSyncRunner, IAsyncDisposable
{
    private readonly MatchMappingSyncService _syncService;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private IPlaywright? _playwright;
    private IBrowserContext? _browserContext;
    private bool _disposed;

    public PersistentBrowserMappingSyncRunner(string browserProfileDir)
    {
        _syncService = new MatchMappingSyncService(browserProfileDir);
    }

    public async Task<MatchMappingSyncResult> SyncAsync(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        bool includeAll,
        string? sourceUrl = null,
        bool interactive = true)
    {
        await _semaphore.WaitAsync();

        try
        {
            ThrowIfDisposed();
            await EnsureBrowserContextAsync();
            return await _syncService.SyncWithBrowserContextAsync(
                _browserContext!,
                existingMappings,
                explicitMatchWebIds,
                includeAll,
                sourceUrl,
                interactive);
        }
        finally
        {
            _semaphore.Release();
        }
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
        if (_browserContext is not null)
            return;

        _playwright = await Playwright.CreateAsync();

        try
        {
            _browserContext = await _syncService.LaunchContextAsync(_playwright, headless: false);
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

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(PersistentBrowserMappingSyncRunner));
    }
}
