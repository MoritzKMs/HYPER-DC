using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HyperDCInstaller;

internal static class InstallEngine
{
    public const string Marker = "HYPER_DC_INSTALLER_V1";
    public const string Version = "0.5.0";
    public static readonly string DataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "HyperDC");
    public static string ResourcePath(string app) => Path.Combine(Path.GetFullPath(app), "resources");
    public static void CheckPath(string path)
    {
        for (var dir = new DirectoryInfo(Path.GetFullPath(path)); dir != null; dir = dir.Parent)
            if (dir.Exists && dir.Attributes.HasFlag(FileAttributes.ReparsePoint)) throw new IOException("Bağlantılı klasörlere kurulum desteklenmiyor.");
    }
    public static bool Owned(string path) => File.Exists(path) && new FileInfo(path).Length < 65536 && Encoding.UTF8.GetString(File.ReadAllBytes(path)).Contains(Marker, StringComparison.Ordinal);
    public static void Validate(string app)
    {
        CheckPath(app);
        var resources = ResourcePath(app);
        CheckPath(resources);
        if (!Directory.Exists(resources) || !Directory.GetFiles(app, "Discord*.exe").Any()) throw new IOException("Discord uygulama klasörü geçerli değil. Discord.exe ve resources klasörü bulunmalı.");
        var asar = Path.Combine(resources, "app.asar");
        var backup = Path.Combine(resources, "_app.asar");
        if (!File.Exists(asar)) throw new IOException("Discord app.asar dosyası bulunamadı.");
        if (new FileInfo(asar).Attributes.HasFlag(FileAttributes.ReparsePoint) || (File.Exists(backup) && new FileInfo(backup).Attributes.HasFlag(FileAttributes.ReparsePoint))) throw new IOException("Bağlantılı uygulama dosyaları desteklenmiyor.");
        if (Directory.Exists(Path.Combine(resources, "app"))) throw new IOException("Başka bir mod kurulumu bulundu (resources/app). Önce onu kaldır.");
        if (File.Exists(backup) && !Owned(asar)) throw new IOException("Başka bir mod veya tamamlanmamış kurulum bulundu. Mevcut _app.asar yedeğine dokunulmadı. Önce o kurulumu kaldır veya onar.");
        if (Owned(asar) && !File.Exists(backup)) throw new IOException("Orijinal Discord yedeği eksik. Önce Discord'u onar.");
    }
    public static byte[] MakeAsar(string patcher, string data)
    {
        var index = Encoding.UTF8.GetBytes($"// {Marker}\nprocess.env.VENCORD_USER_DATA_DIR={JsonSerializer.Serialize(data)};require({JsonSerializer.Serialize(patcher)});");
        var package = Encoding.UTF8.GetBytes("{\"name\":\"discord\",\"main\":\"index.js\"}");
        var header = JsonSerializer.SerializeToUtf8Bytes(new { files = new Dictionary<string, object> {
            ["index.js"] = new { size = index.Length, offset = "0" },
            ["package.json"] = new { size = package.Length, offset = index.Length.ToString(System.Globalization.CultureInfo.InvariantCulture) }
        }});
        var aligned = (header.Length + 3) & ~3;
        using var output = new MemoryStream(); using var writer = new BinaryWriter(output);
        writer.Write(4); writer.Write(aligned + 8); writer.Write(aligned + 4); writer.Write(header.Length);
        writer.Write(header); writer.Write(new byte[aligned - header.Length]); writer.Write(index); writer.Write(package);
        return output.ToArray();
    }
    public static string ExtractPayload(string? destinationRoot = null)
    {
        var dataRoot = destinationRoot ?? DataRoot;
        CheckPath(dataRoot);
        using var input = Assembly.GetExecutingAssembly().GetManifestResourceStream("HyperDCInstaller.payload.zip") ?? throw new IOException("Kurulum paketi bulunamadı.");
        using var memory = new MemoryStream(); input.CopyTo(memory); var bytes = memory.ToArray();
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var target = Path.Combine(dataRoot, "builds", Version + "-" + hash[..12]);
        CheckPath(target);
        Directory.CreateDirectory(target);
        using var archive = new ZipArchive(new MemoryStream(bytes));
        var manifestEntry = archive.GetEntry("manifest.json") ?? throw new IOException("Paket doğrulama listesi yok.");
        using var manifestStream = manifestEntry.Open();
        var manifest = JsonSerializer.Deserialize<Dictionary<string, string>>(manifestStream) ?? throw new IOException("Paket listesi bozuk.");
        foreach (var (name, expectedHash) in manifest)
        {
            if (Path.GetFileName(name) != name || name.Contains('/') || name.Contains('\\')) throw new IOException("Geçersiz paket yolu.");
            var entry = archive.GetEntry(name) ?? throw new IOException("Eksik paket dosyası: " + name);
            using var content = entry.Open(); using var file = new MemoryStream(); content.CopyTo(file);
            var fileBytes = file.ToArray();
            if (!Convert.ToHexString(SHA256.HashData(fileBytes)).Equals(expectedHash, StringComparison.OrdinalIgnoreCase)) throw new IOException("Paket doğrulanamadı: " + name);
            var destination = Path.Combine(target, name);
            if (File.Exists(destination) && new FileInfo(destination).Attributes.HasFlag(FileAttributes.ReparsePoint)) throw new IOException("Bağlantılı paket dosyası.");
            if (!File.Exists(destination) || !File.ReadAllBytes(destination).SequenceEqual(fileBytes)) File.WriteAllBytes(destination, fileBytes);
        }
        if (!File.Exists(Path.Combine(target, "patcher.js")) || !File.Exists(Path.Combine(target, "renderer.js"))) throw new IOException("Paket eksik.");
        var loader = Path.Combine(dataRoot, "bootstrap.cjs");
        CheckPath(loader); CheckPath(loader + ".tmp");
        using var loaderStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("HyperDCInstaller.bootstrap.cjs") ?? throw new IOException("Başlangıç dosyası bulunamadı.");
        using var reader = new StreamReader(loaderStream);
        File.WriteAllText(loader + ".tmp", reader.ReadToEnd());
        File.Move(loader + ".tmp", loader, true);
        var stateFile = Path.Combine(dataRoot, "update-state.json");
        CheckPath(stateFile); CheckPath(stateFile + ".tmp");
        File.WriteAllText(stateFile + ".tmp", JsonSerializer.Serialize(new { current = Path.GetFileName(target), previous = (string?)null, pending = false, attempted = false }));
        File.Move(stateFile + ".tmp", stateFile, true);
        return loader;
    }
    public static void Install(string app, string patcher, string data, Action? beforeCommit = null)
    {
        Validate(app);
        var resources = ResourcePath(app);
        var current = Path.Combine(resources, "app.asar"); var backup = Path.Combine(resources, "_app.asar");
        var temp = Path.Combine(resources, "hyperdc-" + Guid.NewGuid().ToString("N") + ".tmp");
        var previous = File.ReadAllBytes(current);
        var already = Owned(current);
        File.WriteAllBytes(temp, MakeAsar(patcher, data));
        try
        {
            if (!already) File.Move(current, backup);
            beforeCommit?.Invoke();
            File.Move(temp, current, true);
        }
        catch
        {
            if (!already && File.Exists(backup)) { if (File.Exists(current)) File.Delete(current); File.Move(backup, current); }
            else if (already) File.WriteAllBytes(current, previous);
            throw;
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    public static void Uninstall(string app)
    {
        Validate(app);
        var resources = ResourcePath(app); var current = Path.Combine(resources, "app.asar"); var backup = Path.Combine(resources, "_app.asar");
        if (!Owned(current)) throw new IOException("Bu Discord sürümünde HYPER DC kurulu değil.");
        var temp = Path.Combine(resources, "hyperdc-remove-" + Guid.NewGuid().ToString("N") + ".tmp");
        File.Move(current, temp);
        try { File.Move(backup, current); }
        catch { File.Move(temp, current); throw; }
        File.Delete(temp);
    }
}
