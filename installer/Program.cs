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
    readonly ComboBox targets = new() { DropDownStyle = ComboBoxStyle.DropDownList, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 12), BackColor = Color.FromArgb(38, 36, 33), ForeColor = Color.White };
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
        var side = new Panel { Location = Point.Empty, Size = new Size(245, 585), BackColor = Orange };
        Controls.Add(side);
        AddLabel(side, "H", 25, 22, 170, 160, 105, Color.FromArgb(27, 23, 20), FontStyle.Bold | FontStyle.Italic);
        AddLabel(side, "HYPER\nDC.", 30, 211, 210, 155, 36, Color.FromArgb(27, 23, 20), FontStyle.Bold);
        AddLabel(side, "DISCORD.\nSENİN AYARINDA.", 33, 374, 190, 55, 12, Color.FromArgb(43, 28, 21), FontStyle.Bold);
        AddLabel(side, "INSTALLER / 0.1.0\nWINDOWS x64 · ÖN SÜRÜM", 33, 518, 205, 45, 9, Color.FromArgb(77, 43, 26));
        AddLabel(this, "KURULUM MERKEZİ", 283, 30, 450, 25, 9, Color.FromArgb(161, 156, 146));
        AddLabel(this, "Buradan başlıyoruz.", 280, 68, 535, 55, 27, ForeColor, FontStyle.Bold);
        AddLabel(this, "Discord sürümünü seç. HYPER DC paketi bu kurulum\ndosyasına dahildir; indirme beklemezsin.", 284, 127, 520, 48, 11, Color.FromArgb(169, 164, 155));
        AddLabel(this, "DISCORD KURULUMU", 285, 198, 350, 24, 9, Color.FromArgb(169, 164, 155));
        targets.DrawMode = DrawMode.OwnerDrawFixed; targets.ItemHeight = 27; targets.DrawItem += (_, e) => { e.DrawBackground(); if (e.Index >= 0) { using var brush = new SolidBrush(Color.FromArgb(235, 227, 210)); e.Graphics.DrawString(targets.Items[e.Index]?.ToString() ?? "", targets.Font, brush, e.Bounds); } }; targets.SetBounds(285, 229, 360, 36); Controls.Add(targets);
        StyleButton(refresh, "Yenile", new Rectangle(661, 228, 130, 34), false); refresh.Click += (_, _) => Scan();
        path.SetBounds(285, 274, 506, 33); Controls.Add(path);
        StyleButton(browse, "Klasör seç…", new Rectangle(285, 312, 145, 33), false); browse.Click += (_, _) => Browse();
        AddLabel(this, "HYPER DC dosyaları: %AppData%\\HyperDC", 285, 353, 505, 23, 9, Color.FromArgb(169, 164, 155));
        consent.SetBounds(285, 389, 515, 30); Controls.Add(consent);
        StyleButton(install, "HYPER DC’yi yükle", new Rectangle(285, 431, 242, 46), true); install.Click += async (_, _) => await Execute(false);
        StyleButton(remove, "HYPER DC’yi kaldır", new Rectangle(540, 431, 251, 46), false); remove.Click += async (_, _) => await Execute(true);
        status.SetBounds(285, 491, 507, 54); Controls.Add(status);
        var license = new LinkLabel { Text = "Vencord tabanlı · GPL-3.0-or-later", LinkColor = Color.FromArgb(153, 146, 134), Location = new Point(285, 557), Size = new Size(470, 21), Font = new Font("Segoe UI", 8) };
        license.LinkClicked += (_, _) => Process.Start(new ProcessStartInfo("https://github.com/MoritzKMs/HYPER-DC/blob/main/LICENSE") { UseShellExecute = true }); Controls.Add(license);
        targets.SelectedIndexChanged += (_, _) => { path.Text = (targets.SelectedItem as DiscordTarget)?.Path ?? ""; UpdateButtons(); };
        consent.CheckedChanged += (_, _) => UpdateButtons();
        FormClosing += (_, e) => { if (working) e.Cancel = true; };
        if (preview) { targets.Items.Add(new DiscordTarget("Discord Stable · app-1.0.9200", @"C:\Users\Moritz\AppData\Local\Discord\app-1.0.9200")); targets.SelectedIndex = 0; status.Text = "Kuruluma hazır. Önce Discord’u tamamen kapat."; }
        else Scan();
    }
    void AddLabel(Control parent, string text, int x, int y, int w, int h, float size, Color color, FontStyle style = FontStyle.Regular) => parent.Controls.Add(new Label { Text = text, Location = new Point(x, y), Size = new Size(w, h), Font = new Font("Segoe UI", size, style), ForeColor = color, BackColor = Color.Transparent });
    void StyleButton(Button button, string text, Rectangle bounds, bool primary)
    {
        button.Text = text; button.Bounds = bounds; button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderColor = Color.FromArgb(70, 64, 56);
        button.BackColor = primary ? Orange : Color.FromArgb(32, 31, 28); button.ForeColor = primary ? Color.FromArgb(30, 21, 15) : ForeColor;
        button.Font = new Font("Segoe UI", 10, FontStyle.Bold); button.Cursor = Cursors.Hand; Controls.Add(button);
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


