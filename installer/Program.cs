using System.Diagnostics;
using System.Reflection;

namespace HyperDCInstaller;
internal static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Length == 2 && args[0] == "--self-test") return SelfTest.Run(args[1]);
        if (args.Length == 2 && args[0] == "--render-preview")
        {
            using var preview = new InstallerForm(true);
            preview.Show(); Application.DoEvents();
            using var image = new Bitmap(preview.Width, preview.Height);
            preview.DrawToBitmap(image, new Rectangle(Point.Empty, image.Size)); image.Save(args[1]); preview.Close(); return 0;
        }
        Application.Run(new InstallerForm(false)); return 0;
    }
}
internal record DiscordTarget(string Name, string Path)
{
    public override string ToString() => Name;
}
internal sealed class InstallerForm : Form
{
    readonly Color Orange = Color.FromArgb(252, 112, 69);
    readonly ListBox targets = new() { BorderStyle = BorderStyle.FixedSingle, IntegralHeight = false, Font = new Font("Segoe UI", 12), BackColor = Color.FromArgb(38, 36, 33), ForeColor = Color.White };
    readonly Label path = new() { AutoEllipsis = true, ForeColor = Color.FromArgb(161, 156, 146), Font = new Font("Segoe UI", 9) };
    readonly Label status = new() { ForeColor = Color.FromArgb(225, 215, 197), Font = new Font("Segoe UI", 10), AutoEllipsis = false };
    readonly CheckBox consent = new() { Text = "Seçili Discord kurulumuna HYPER DC yükle.", AutoSize = false, ForeColor = Color.FromArgb(219, 215, 204), Font = new Font("Segoe UI", 10) };
    readonly Button install = new(), remove = new(), browse = new(), refresh = new();
    bool working;
    public InstallerForm(bool preview)
    {
        Text = "HYPER DC Installer"; ClientSize = new Size(850, 585);
        FormBorderStyle = FormBorderStyle.FixedSingle; MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(20, 20, 20); ForeColor = Color.FromArgb(242, 238, 231); AutoScaleMode = AutoScaleMode.Dpi;
        using var iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("HyperDCInstaller.assets.hyperdc.ico");
        if (iconStream != null) Icon = new Icon(iconStream);
        ClientSize = new Size(700, 560);
        BackColor = Color.FromArgb(246, 246, 246); ForeColor = Color.FromArgb(32, 32, 32);
        var header = new Panel { Dock = DockStyle.Top, Height = 92, BackColor = Color.White };
        Controls.Add(header);
        using var logoStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("HyperDCInstaller.assets.hyperdc.png");
        if (logoStream != null) header.Controls.Add(new PictureBox { Image = new Bitmap(logoStream), SizeMode = PictureBoxSizeMode.Zoom, Bounds = new Rectangle(24, 19, 52, 52) });
        AddLabel(header, "HyperDC Kurulumu", 92, 19, 560, 32, 18, ForeColor, FontStyle.Bold);
        AddLabel(header, "Sürüm 0.4.1 · Windows x64", 94, 55, 520, 22, 9, Color.DimGray);
        AddLabel(this, "Discord kurulumunu seçin", 24, 114, 620, 28, 12, ForeColor, FontStyle.Bold);
        AddLabel(this, "Devam etmeden önce Discord’u sistem tepsisinden de kapatın.", 24, 146, 644, 26, 10, Color.DimGray);
        targets.BackColor = Color.White; targets.ForeColor = ForeColor;
        targets.Font = new Font("Segoe UI", 10); targets.SetBounds(24, 184, 520, 88); Controls.Add(targets);
        StyleButton(refresh, "Yenile", new Rectangle(558, 184, 118, 34), false); refresh.Click += (_, _) => Scan();
        StyleButton(browse, "Klasör seç…", new Rectangle(558, 230, 118, 34), false); browse.Click += (_, _) => Browse();
        path.ForeColor = Color.DimGray; path.SetBounds(24, 281, 652, 40); Controls.Add(path);
        AddLabel(this, "Program dosyaları: %AppData%\\HyperDC", 24, 330, 652, 24, 9, Color.DimGray);
        consent.Text = "Seçili Discord kurulumuna HyperDC yükle."; consent.ForeColor = ForeColor;
        consent.SetBounds(24, 364, 652, 28); Controls.Add(consent);
        status.ForeColor = ForeColor; status.SetBounds(24, 410, 652, 48); Controls.Add(status);
        var divider = new Panel { Bounds = new Rectangle(0, 480, 700, 1), BackColor = Color.LightGray }; Controls.Add(divider);
        var license = new LinkLabel { Text = "Lisans ve kaynak kodu", LinkColor = Color.DimGray, Location = new Point(24, 509), Size = new Size(180, 24), Font = new Font("Segoe UI", 9) };
        license.LinkClicked += (_, _) => Process.Start(new ProcessStartInfo("https://github.com/MoritzKMs/HYPER-DC") { UseShellExecute = true }); Controls.Add(license);
        StyleButton(remove, "Kaldır", new Rectangle(412, 500, 120, 36), false); remove.Click += async (_, _) => await Execute(true);
        StyleButton(install, "Yükle", new Rectangle(546, 500, 130, 36), true); install.Click += async (_, _) => await Execute(false);
        targets.SelectedIndexChanged += (_, _) => { path.Text = (targets.SelectedItem as DiscordTarget)?.Path ?? ""; UpdateButtons(); };
        consent.CheckedChanged += (_, _) => UpdateButtons();
        FormClosing += (_, e) => { if (working) e.Cancel = true; };
        if (preview) { targets.Items.Add(new DiscordTarget("Discord Stable · app-1.0.9200", @"C:\Users\Moritz\AppData\Local\Discord\app-1.0.9200")); targets.SelectedIndex = 0; status.Text = "Kuruluma hazır. Önce Discord’u tamamen kapat."; }
        else Scan();
    }
    void AddLabel(Control parent, string text, int x, int y, int w, int h, float size, Color color, FontStyle style = FontStyle.Regular) => parent.Controls.Add(new Label { Text = text, Location = new Point(x, y), Size = new Size(w, h), Font = new Font("Segoe UI", size, style), ForeColor = color, BackColor = Color.Transparent });
    void StyleButton(Button button, string text, Rectangle bounds, bool primary)
    {
        button.Text = text; button.Bounds = bounds; button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderColor = primary ? Orange : Color.Silver;
        button.BackColor = primary ? Orange : Color.White; button.ForeColor = primary ? Color.FromArgb(30, 21, 15) : ForeColor;
        button.Font = new Font("Segoe UI", 10, FontStyle.Regular); button.Cursor = Cursors.Hand; Controls.Add(button);
    }
    void UpdateButtons()
    {
        install.Enabled = !working && consent.Checked && targets.SelectedItem != null;
        remove.Enabled = !working && targets.SelectedItem is DiscordTarget t && InstallEngine.Owned(Path.Combine(t.Path, "resources", "app.asar"));
        browse.Enabled = refresh.Enabled = targets.Enabled = consent.Enabled = !working;
    }
    void Scan()
    {
        targets.Items.Clear();
        foreach (var name in new[] { "Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment" })
        {
            var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), name);
            if (!Directory.Exists(root)) continue;
            foreach (var dir in Directory.GetDirectories(root, "app-*").OrderByDescending(d => System.Version.TryParse(System.IO.Path.GetFileName(d)[4..], out var v) ? v : new System.Version()))
                if (File.Exists(Path.Combine(dir, "resources", "app.asar"))) targets.Items.Add(new DiscordTarget(name + " · " + Path.GetFileName(dir), dir));
        }
        if (targets.Items.Count > 0) targets.SelectedIndex = 0;
        status.Text = targets.Items.Count > 0 ? "Kuruluma hazır. Önce Discord’u tamamen kapat." : "Discord bulunamadı. Discord.exe dosyasının bulunduğu klasörü seç.";
        UpdateButtons();
    }
    void Browse()
    {
        using var dialog = new FolderBrowserDialog { Description = "Discord.exe ve resources klasörünün bulunduğu app-* klasörünü seç.", UseDescriptionForTitle = true };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try { InstallEngine.Validate(dialog.SelectedPath); var target = new DiscordTarget("Özel kurulum · " + Path.GetFileName(dialog.SelectedPath), dialog.SelectedPath); targets.Items.Add(target); targets.SelectedItem = target; }
        catch (Exception ex) { status.Text = ex.Message; }
    }
    async Task Execute(bool uninstall)
    {
        if (working || targets.SelectedItem is not DiscordTarget target) return;
        if (Process.GetProcesses().Any(p => { using (p) { return p.ProcessName.StartsWith("Discord", StringComparison.OrdinalIgnoreCase); } })) { status.Text = "Discord açık. Sistem tepsisinden de kapatıp tekrar dene."; return; }
        if (uninstall && MessageBox.Show(this, "Seçili kurulumdan HYPER DC kaldırılacak. Discord’un orijinal dosyası geri yüklenecek; HYPER DC ayarların korunacak.", "HYPER DC’yi kaldır", MessageBoxButtons.OKCancel) != DialogResult.OK) return;
        working = true; UpdateButtons(); status.Text = uninstall ? "Orijinal Discord dosyası geri yükleniyor…" : "Paket doğrulanıyor ve kurulum hazırlanıyor…";
        try
        {
            await Task.Run(() => { if (uninstall) InstallEngine.Uninstall(target.Path); else { InstallEngine.Validate(target.Path); var patcher = InstallEngine.ExtractPayload(); InstallEngine.Install(target.Path, patcher, InstallEngine.DataRoot); } });
            status.Text = uninstall ? "HYPER DC kaldırıldı. Discord’u açabilirsin." : "Kurulum tamamlandı. Discord’u aç; Eklentiler bölümünde HyperQuiet’i bul.";
        }
        catch (Exception ex) { status.Text = "İşlem tamamlanamadı: " + ex.Message; }
        finally { working = false; UpdateButtons(); }
    }
}




