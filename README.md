# HYPER DC

Vencord tabanlı Discord modifikasyonu. HYPER Quiet eklentisi ve HYPER DC’ye özel Windows installer içerir.

[Web sitesi](https://moritzkms.github.io/HYPER-DC/) · [İndirmeler](https://github.com/MoritzKMs/HYPER-DC/releases) · [Orijinal Vencord](https://github.com/Vendicated/Vencord)

[Katkıda bulunma](CONTRIBUTING.md) · [Topluluk kuralları](CODE_OF_CONDUCT.md) · [Lisans hakkında](LISANS.md)

## HYPER Deck

Ses kanalındayken sohbet kutusundaki dalga simgesinden veya eklenti ayarlarından açılır. MP3 seçimi, frekans görselleştiricisi, oynat/duraklat, konum ve ses ayarı, tekrar ve yerel dinleme içerir. Dosya en fazla 100 MB olabilir; bir sunucuya yüklenmez.

**Ses kanalına aktarım için VB-CABLE / VoiceMeeter gibi kurulu bir sanal ses aygıtı gerekir.** Eklenti sürücü kurmaz. Burada `CABLE Input`, Discord’un giriş aygıtında `CABLE Output` seçilir. Discord çıkışı fiziksel kulaklık olarak kalmalıdır. İsteğe bağlı olarak fiziksel mikrofon da müzikle karıştırılır.

Aktarım tiki açılınca müzik sanal aygıta yönlendirilir. Karşı tarafın duyduğu ayrıca kontrol edilmelidir. Gürültü bastırma müziği kesebilir; bas-konuş ayarında tuşa basılması gerekir. Panel kapanınca, kanal veya aygıt değişince ve kendini susturunca aktarım kapanır; otomatik yeniden açılmaz. Sanal aygıt yoksa yerel oynatıcı kullanılabilir.

HyperDeck, 0.2.0 ön sürümüyle gelir. Gerçek Discord ses oturumunda henüz doğrulanmadı.

## Windows kurulumu

1. Releases bölümünden **HyperDCInstaller.exe** dosyasını indir.
2. Discord’u sistem tepsisi dahil tamamen kapat.
3. HYPER DC Installer’ı aç, Discord Stable / PTB / Canary kurulumunu seç.
4. Seçimi onaylayıp **HYPER DC’yi yükle** düğmesine bas.
5. Discord’u yeniden aç. Ayarlar → HYPER DC → Plugins bölümünde **HyperQuiet** ayarlarını aç.

Installer Windows x64 içindir, .NET çalışma zamanını ve HYPER DC paketini içerir. Kurulumda ayrıca VencordInstaller indirmez veya çalıştırmaz. Bu ilk paket ön sürümdür; gerçek Discord oturumunda uçtan uca test henüz yapılmamıştır. Dosya dijital olarak imzalı değildir.

### Ayrı dosya konumu

HYPER DC, mevcut Vencord klasörünü kullanmaz:

- Uygulama dosyaları: `%AppData%\HyperDC\builds\<sürüm-paket-hash>`
- Ayarlar: `%AppData%\HyperDC\settings`
- Temalar: `%AppData%\HyperDC\themes`
- Yerel tarayıcı verileri: `HyperDCData` adlı IndexedDB veritabanı

Discord’un `resources/app.asar` dosyası HYPER DC’ye bağlanır; orijinali `resources/_app.asar` olarak korunur. Başka bir mod kurulumu veya yabancı yedek varsa installer üzerine yazmaz; önce mevcut modun kendi kaldırma işlemini kullan. Vencord kullanıcı verileri taşınmaz veya silinmez.

Kaldırmak için installer’dan aynı Discord sürümünü seçip **HYPER DC’yi kaldır** düğmesine bas. Orijinal Discord dosyası geri yüklenir; HYPER DC ayarları korunur.

## HYPER Quiet

Sunucuların bildirim ayarlarını topluca yönetir. Etkinleştiğinde otomatik olarak sunucuları susturmaz; işlem yalnızca **Ayarları uygula** düğmesiyle başlar.

- Sunucu adına göre arama ve hariç tutma listesi.
- Tamamen susturma veya yalnızca bahsetmeler modu.
- `@everyone` / `@here`, rol bahsetmeleri, etkinlikler ve öne çıkanlar için seçenekler.
- Mobil push bildirimlerini açma veya kapatma.
- Mevcut kanal bildirim istisnalarını da aynı moda alma seçeneği.
- Hesaba özel yerel yedek, geri alma, ilerleme durumu ve durdurma.
- İstekler sırayla gönderilir; ilk hatada işlem durur ve kalan yedekler korunur.

**Hariç tutulan sunucuların mevcut ayarları korunur.** Daha önce susturulmuş bir sunucuyu hariç tutmak onu otomatik açmaz; gerekirse önce yedekten geri al veya Discord bildirim ayarlarından aç. Yalnızca bahsetmeler modunda rol / herkes bahsetmelerini istiyorsan ilgili bastırma seçeneklerini kapat.

Bildirim değişiklikleri Discord hesabına uygulanır ve diğer cihazlara da yansıyabilir. DM bildirimleri değişmez. Eklentiyi devre dışı bırakmak sunucu ayarlarını geri almaz; **Yedekten geri al** kullan. Geri alma, değiştirilen alanları ilk yedeğe döndürür; bu alanlarda sonradan yaptığın elle değişikliklerin üzerine yazabilir. Yedekler yerel veriler temizlenirse kaybolur.

Yeni katılınan sunucular için otomatik işlem yapılmaz; gerektiğinde listeyi yeniden açıp uygula.

## Kaynaktan derleme

Gereksinimler: Node.js 22+ (test komutu için Node.js 24+), pnpm, Python 3, Windows x64 ve .NET 9 SDK.

```powershell
pnpm install --frozen-lockfile
$env:VENCORD_HASH = "hyperdc-0.2.0"
node scripts/build/build.mjs --standalone --disable-updater
node node_modules/typescript/bin/tsc --noEmit
node tests/hyperQuiet.test.mjs
python installer/package_payload.py
dotnet publish installer/HyperDCInstaller.csproj -c Release -r win-x64 -o release
```

İkon kaynakları `installer/assets` altındadır. İkonu yeniden üretmek için Pillow ile `python installer/assets/make_icon.py` çalıştırılabilir; mevcut ICO derleme için yeterlidir.

`--disable-updater` bilerek kullanılır: bu paket upstream Vencord güncellemesiyle değiştirilmez. Yeni HYPER DC sürümleri bu reponun Releases bölümünden yüklenir. Upstream’in `pnpm inject` komutu bu projede kullanılmaz.

### Kontroller

- Masaüstü bundle derlemesi ve TypeScript kontrolü.
- HyperQuiet mantık testleri: modlar, kanal seçeneği, ilk yedeğin korunması ve silinen kanal filtreleme.
- Installer self-test: kurulum, yeniden kurulum, kaldırma, ASAR düzeni, hata geri dönüşü ve yabancı mod koruması.

```powershell
.\release\HyperDCInstaller.exe --self-test "$PWD\release\installer-tests.txt"
```

Self-test geçici bir örnek kurulum üzerinde çalışır; gerçek Discord dosyalarını değiştirmez. İlk sürüm, Discord oturumundaki modül/API uyumluluğu ve bildirim davranışı kullanıcı tarafından doğrulanana kadar ön sürüm olarak sunulur.

## Lisans ve kaynak

Vencord kaynakları, orijinal telif bildirimleri ve katkı geçmişi korunur. HYPER DC değişiklikleri GPL-3.0-or-later kapsamında sunulur. Installer’ın ASAR yapısı Vencord Installer’ın açık kaynak yaklaşımıyla uyumludur; arayüz ve kurulum uygulaması HYPER DC için ayrı yazılmıştır.

HYPER DC, Discord veya Vencord’un resmî ürünü değildir. Discord istemci modifikasyonları Discord kullanım koşullarına aykırı olabilir.
