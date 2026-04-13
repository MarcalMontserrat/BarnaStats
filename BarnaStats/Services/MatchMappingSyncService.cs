using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace BarnaStats.Services;

public sealed class MatchMappingSyncService
{
    private static readonly Regex UuidRegex = new(
        "/estadistiques/([a-f0-9]{24})(?:[/?#\"'<> ]|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly string _browserProfileDir;

    public MatchMappingSyncService(string browserProfileDir)
    {
        _browserProfileDir = browserProfileDir;
    }

    public async Task<Dictionary<int, string?>> ResolveAsync(IReadOnlyList<int> matchWebIds)
    {
        var resolved = new Dictionary<int, string?>();

        using var playwright = await Playwright.CreateAsync();
        await using var browser = await LaunchContextAsync(playwright);

        var page = browser.Pages.FirstOrDefault() ?? await browser.NewPageAsync();

        Console.WriteLine("Se abrirá un navegador real para reutilizar tu sesión.");
        Console.WriteLine("Si aparece login o captcha, resuélvelo ahí y vuelve al terminal.");
        Console.WriteLine("Pulsa ENTER cuando la web de basquetcatala esté lista.");

        await page.GotoAsync("https://www.basquetcatala.cat/", new PageGotoOptions
        {
            WaitUntil = WaitUntilState.DOMContentLoaded
        });

        Console.ReadLine();

        foreach (var matchWebId in matchWebIds)
        {
            resolved[matchWebId] = await ResolveSingleAsync(page, matchWebId);
        }

        return resolved;
    }

    private async Task<string?> ResolveSingleAsync(IPage page, int matchWebId)
    {
        while (true)
        {
            Console.WriteLine($"Resolviendo uuid para matchWebId={matchWebId}...");

            await page.GotoAsync(
                $"https://www.basquetcatala.cat/partits/llistatpartits/{matchWebId}",
                new PageGotoOptions
                {
                    WaitUntil = WaitUntilState.DOMContentLoaded
                });

            await page.WaitForTimeoutAsync(1000);

            var uuid = await ExtractUuidAsync(page);
            if (!string.IsNullOrWhiteSpace(uuid))
            {
                Console.WriteLine($"  OK -> {uuid}");
                return uuid;
            }

            Console.WriteLine("  No se pudo extraer el uuid automáticamente.");
            Console.WriteLine($"  URL actual: {page.Url}");
            Console.WriteLine("  Revisa la página en el navegador, resuelve captcha si aparece y pulsa ENTER para reintentar.");
            Console.WriteLine("  Escribe 'skip' y pulsa ENTER para saltar este partido.");

            var input = Console.ReadLine()?.Trim().ToLowerInvariant();
            if (input == "skip")
            {
                Console.WriteLine("  SKIP");
                return null;
            }
        }
    }

    private async Task<IBrowserContext> LaunchContextAsync(IPlaywright playwright)
    {
        Directory.CreateDirectory(_browserProfileDir);

        try
        {
            return await playwright.Chromium.LaunchPersistentContextAsync(
                _browserProfileDir,
                new BrowserTypeLaunchPersistentContextOptions
                {
                    Headless = false,
                    Channel = "chrome"
                });
        }
        catch (PlaywrightException ex) when (CanFallbackToBundledChromium(ex))
        {
            Console.WriteLine("No se pudo abrir Chrome del sistema. Intentando Chromium de Playwright...");

            return await playwright.Chromium.LaunchPersistentContextAsync(
                _browserProfileDir,
                new BrowserTypeLaunchPersistentContextOptions
                {
                    Headless = false
                });
        }
    }

    private static bool CanFallbackToBundledChromium(PlaywrightException ex)
    {
        var message = ex.Message ?? "";
        return message.Contains("channel", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("executable", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("Cannot find", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string?> ExtractUuidAsync(IPage page)
    {
        var domUuid = await page.EvaluateAsync<string?>(
            """
            () => {
                const links = [...document.querySelectorAll('a[href]')];

                const statLinks = links.filter((a) =>
                    (a.textContent || '').toLowerCase().includes('estad')
                );

                const allCandidates = [...statLinks, ...links];

                for (const a of allCandidates) {
                    const href = a.getAttribute('href') || '';
                    const match = href.match(/\/estadistiques\/([a-f0-9]{24})(?:[/?#]|$)/i);
                    if (match) {
                        return match[1];
                    }
                }

                return null;
            }
            """);

        if (!string.IsNullOrWhiteSpace(domUuid))
            return domUuid;

        var html = await page.ContentAsync();
        var rawMatch = UuidRegex.Match(html);
        return rawMatch.Success ? rawMatch.Groups[1].Value : null;
    }
}
