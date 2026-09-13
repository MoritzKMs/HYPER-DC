using System.Text;
using System.Text.Json;
namespace HyperDCInstaller;
internal static class SelfTest
{
    public static int Run(string output)
    {
        var root = Path.Combine(Path.GetTempPath(), "hyperdc-test-" + Guid.NewGuid().ToString("N"));
        var results = new List<string>();
        try
        {
            var resources = Path.Combine(root, "resources"); Directory.CreateDirectory(resources);
            File.WriteAllText(Path.Combine(root, "Discord.exe"), "fixture");
            var app = Path.Combine(resources, "app.asar"); var backup = Path.Combine(resources, "_app.asar");
            byte[] original = Encoding.UTF8.GetBytes("original-discord-fixture"); File.WriteAllBytes(app, original);
            InstallEngine.Install(root, "C:/HyperDC/patcher.js", "C:/HyperDC");
            Assert(File.ReadAllBytes(backup).SequenceEqual(original) && InstallEngine.Owned(app), "Install preserves original", results);
            var archive = File.ReadAllBytes(app); var jsonLen = BitConverter.ToInt32(archive, 12); var headerLen = BitConverter.ToInt32(archive, 4);
            using var header = JsonDocument.Parse(archive.AsMemory(16, jsonLen));
            var file = header.RootElement.GetProperty("files").GetProperty("index.js");
            var script = Encoding.UTF8.GetString(archive, 8 + headerLen + int.Parse(file.GetProperty("offset").GetString()!), file.GetProperty("size").GetInt32());
            Assert(script.Contains("VENCORD_USER_DATA_DIR") && script.Contains("patcher.js"), "ASAR header and payload offsets", results);
            InstallEngine.Install(root, "C:/HyperDC/new/patcher.js", "C:/HyperDC");
            Assert(File.ReadAllBytes(backup).SequenceEqual(original), "Reinstall preserves original backup", results);
            var dataRoot = Path.Combine(root, "HyperDC");
            Directory.CreateDirectory(Path.Combine(dataRoot, "settings"));
            var settings = Path.Combine(dataRoot, "settings", "settings.json");
            File.WriteAllText(settings, "{\"keep\":true}");
            var loader = InstallEngine.ExtractPayload(dataRoot);
            InstallEngine.Install(root, loader, dataRoot);
            using var updateState = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataRoot, "update-state.json")));
            var build = updateState.RootElement.GetProperty("current").GetString()!;
            Assert(loader.EndsWith("bootstrap.cjs") && File.Exists(Path.Combine(dataRoot, "builds", build, "patcher.js")), "Bootstrap and update state point to packaged build", results);
            Assert(File.ReadAllText(settings) == "{\"keep\":true}" && File.ReadAllBytes(backup).SequenceEqual(original), "Migration preserves settings and original Discord backup", results);
            InstallEngine.Uninstall(root);
            Assert(File.ReadAllBytes(app).SequenceEqual(original) && !File.Exists(backup), "Uninstall restores original bytes", results);
            try { InstallEngine.Install(root, "p.js", "data", () => throw new IOException("simulated write failure")); } catch (IOException) { }
            Assert(File.ReadAllBytes(app).SequenceEqual(original) && !File.Exists(backup), "Failed install rollback", results);
            File.WriteAllText(backup, "foreign backup");
            bool rejected = false; try { InstallEngine.Install(root, "p.js", "data"); } catch (IOException) { rejected = true; }
            Assert(rejected && File.ReadAllText(backup) == "foreign backup" && File.ReadAllBytes(app).SequenceEqual(original), "Foreign modifications preserved", results);
            results.Add("PASS: All installer filesystem tests passed. No live Discord installation was modified.");
            File.WriteAllLines(output, results); return 0;
        }
        catch (Exception ex) { results.Add("FAIL: " + ex); File.WriteAllLines(output, results); return 1; }
    }
    static void Assert(bool value, string name, List<string> results) { if (!value) throw new Exception(name); results.Add("PASS: " + name); }
}
