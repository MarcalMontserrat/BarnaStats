using BarnaStats.Api.Services;
using BarnaStats.Utilities;

namespace GenerateAnalisys.Tests;

public sealed class AppAccountStatusServiceTests
{
    private static readonly string[] AccountEnvVars =
    [
        AppAccountSettings.UserEnvVar,
        AppAccountSettings.PasswordEnvVar,
        AppAccountSettings.EsbKeyEnvVar
    ];

    [Fact]
    public void GetStatus_reads_the_local_settings_file_when_there_are_no_environment_variables()
    {
        var projectDir = Path.Combine(Path.GetTempPath(), $"barna-tests-{Guid.NewGuid():N}");
        var previousValues = AccountEnvVars.ToDictionary(name => name, Environment.GetEnvironmentVariable);

        try
        {
            foreach (var name in AccountEnvVars)
                Environment.SetEnvironmentVariable(name, null);

            var phaseDir = Path.Combine(projectDir, "out", "phases", "23958");
            Directory.CreateDirectory(phaseDir);
            File.WriteAllText(
                Path.Combine(projectDir, "out", AppAccountSettings.FileName),
                """{"fcbqUser": "", "fcbqEsbKey": "esb-key"}""");
            File.WriteAllText(
                Path.Combine(phaseDir, "match_mapping.json"),
                """[{"matchWebId": 28618, "statsSource": "app"}, {"matchWebId": 28619}]""");

            var status = new AppAccountStatusService(BarnaStatsPaths.CreateFromProjectDir(projectDir)).GetStatus();

            Assert.False(status.Configured);
            Assert.Equal(["usuario", "contraseña"], status.MissingFields);
            Assert.Equal(1, status.AppMatches);

            // La variable de entorno manda sobre el fichero.
            Environment.SetEnvironmentVariable(AppAccountSettings.UserEnvVar, "user@example.com");
            Environment.SetEnvironmentVariable(AppAccountSettings.PasswordEnvVar, "test-password");

            var overridden = new AppAccountStatusService(BarnaStatsPaths.CreateFromProjectDir(projectDir)).GetStatus();

            Assert.True(overridden.Configured);
            Assert.Equal($"variables de entorno + {AppAccountSettings.FileName}", overridden.Source);
        }
        finally
        {
            foreach (var (name, value) in previousValues)
                Environment.SetEnvironmentVariable(name, value);

            if (Directory.Exists(projectDir))
                Directory.Delete(projectDir, true);
        }
    }
}
