using System.Diagnostics;
using System.Text.Json;
using BarnaStats.Services;

namespace BarnaStats.Utilities;

// Configuración de la cuenta de la app de Bàsquet Català. Se lee de variables de entorno y, si no están,
// de `BarnaStats/out/local-settings.json` (fuera de git). Así funciona igual se arranque desde Rider,
// desde una terminal antigua o con `npm run dev:all`.
public sealed class AppAccountSettings
{
    public const string FileName = "local-settings.json";
    public const string UserEnvVar = "BARNASTATS_FCBQ_USER";
    public const string PasswordEnvVar = "BARNASTATS_FCBQ_PASSWORD";
    public const string EsbKeyEnvVar = "BARNASTATS_FCBQ_ESB_KEY";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public string? User { get; private init; }
    public string? Password { get; private init; }
    public string? EsbKey { get; private init; }
    public string SettingsFile { get; private init; } = "";
    public string? Source { get; private init; }
    public string? Error { get; private init; }

    // Con una sesión guardada todavía válida la contraseña no hace falta: solo se usa para volver a hacer login.
    public bool HasCachedSession { get; private init; }
    public bool HasPassword => !string.IsNullOrWhiteSpace(Password);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(User) &&
                                (HasPassword || HasCachedSession) &&
                                !string.IsNullOrWhiteSpace(EsbKey);

    public IReadOnlyList<string> MissingFields => new[]
        {
            (Name: "usuario", Value: User),
            (Name: "contraseña", Value: HasCachedSession ? "sesión guardada" : Password),
            (Name: "clave ESB", Value: EsbKey)
        }
        .Where(entry => string.IsNullOrWhiteSpace(entry.Value))
        .Select(entry => entry.Name)
        .ToList();

    public static string GetSessionTokenFile(string outputDir) => Path.Combine(outputDir, "tmp", "fcbq-app-token.txt");

    public static AppAccountSettings Resolve(string outputDir)
    {
        var settingsFile = Path.Combine(outputDir, FileName);
        var (file, fileError) = LoadFile(settingsFile);

        var envUser = ReadEnv(UserEnvVar);
        var envPassword = ReadEnv(PasswordEnvVar);
        var envEsbKey = ReadEnv(EsbKeyEnvVar);

        string? keychainError = null;
        var filePassword = file?.FcbqPassword;
        if (string.IsNullOrWhiteSpace(envPassword) && string.IsNullOrWhiteSpace(filePassword) &&
            !string.IsNullOrWhiteSpace(file?.FcbqPasswordKeychainService))
        {
            (filePassword, keychainError) = ReadKeychainPassword(file.FcbqPasswordKeychainService!, file.FcbqPasswordKeychainAccount);
        }

        var usesEnv = !string.IsNullOrWhiteSpace(envUser) || !string.IsNullOrWhiteSpace(envPassword) || !string.IsNullOrWhiteSpace(envEsbKey);
        var usesFile = file is not null;

        return new AppAccountSettings
        {
            User = envUser ?? file?.FcbqUser?.Trim(),
            Password = envPassword ?? filePassword,
            EsbKey = envEsbKey ?? file?.FcbqEsbKey?.Trim(),
            SettingsFile = settingsFile,
            HasCachedSession = MsStatsTokenStore.LoadValid(GetSessionTokenFile(outputDir)) is not null,
            Source = usesEnv && usesFile ? $"variables de entorno + {FileName}" : usesEnv ? "variables de entorno" : usesFile ? FileName : null,
            Error = fileError ?? keychainError
        };
    }

    private static string? ReadEnv(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static (LocalSettingsFile? Settings, string? Error) LoadFile(string settingsFile)
    {
        if (!File.Exists(settingsFile))
            return (null, null);

        try
        {
            return (JsonSerializer.Deserialize<LocalSettingsFile>(File.ReadAllText(settingsFile), JsonOptions), null);
        }
        catch (Exception ex) when (ex is JsonException or IOException)
        {
            return (null, $"No se pudo leer {FileName}: {ex.Message}");
        }
    }

    // Permite no guardar la contraseña en claro: `security add-generic-password -a "$USER" -s barnastats-fcbq -w`.
    private static (string? Password, string? Error) ReadKeychainPassword(string service, string? account)
    {
        if (!OperatingSystem.IsMacOS())
            return (null, "El llavero solo está disponible en macOS.");

        try
        {
            var startInfo = new ProcessStartInfo("security")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            startInfo.ArgumentList.Add("find-generic-password");
            if (!string.IsNullOrWhiteSpace(account))
            {
                startInfo.ArgumentList.Add("-a");
                startInfo.ArgumentList.Add(account);
            }

            startInfo.ArgumentList.Add("-s");
            startInfo.ArgumentList.Add(service);
            startInfo.ArgumentList.Add("-w");

            using var process = Process.Start(startInfo);
            if (process is null)
                return (null, "No se pudo consultar el llavero.");

            var password = process.StandardOutput.ReadToEnd().TrimEnd('\n', '\r');
            process.WaitForExit(5000);
            return process.ExitCode == 0 && !string.IsNullOrEmpty(password)
                ? (password, null)
                : (null, $"No hay contraseña en el llavero para el servicio '{service}'.");
        }
        catch (Exception ex)
        {
            return (null, $"No se pudo consultar el llavero: {ex.Message}");
        }
    }

    private sealed class LocalSettingsFile
    {
        public string? FcbqUser { get; set; }
        public string? FcbqPassword { get; set; }
        public string? FcbqPasswordKeychainService { get; set; }
        public string? FcbqPasswordKeychainAccount { get; set; }
        public string? FcbqEsbKey { get; set; }
    }
}
