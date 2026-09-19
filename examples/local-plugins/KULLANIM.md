# HyperDC yerel JS eklentileri

HyperDC ayarlarında **HyperLocalPlugins** bölümünü aç. **Klasörü aç** düğmesi o bilgisayardaki eklenti klasörünü açar. `kelime-sayaci.plugin.js` dosyasını buraya kopyala; **Listeyi yenile → Kodu incele / yükle** adımlarından sonra kodu inceleyip etkinleştir.

Eklentiler her Discord açılışında kapalı başlar. Kaynak dosya değişirse yeniden inceleme gerekir. En fazla 4 eklenti aynı anda çalışabilir; dosya başına sınır 512 KB, panelde metin sınırı 4.000 karakterdir. Liste ilk 200 dosyayı gösterir. Dosya adında Latin harfleri, rakamlar, boşluk, alt çizgi veya tire kullan.

## API

```js
module.exports = {
    start(api) {
        api.show("Bir metin yaz.");
    },
    onInput(api, text) {
        api.show(text.toLocaleUpperCase("tr-TR"));
    }
};
```

`start(api)` etkinleştirildiğinde bir kez çağrılır. İsteğe bağlı `onInput(api, text)` panelde Gönder'e basıldığında çağrılır. İkisi de async olabilir. `api.show(text)` o eklentinin panel çıktısını değiştirir; HTML çalıştırmaz. Durdur düğmesi çalışma ortamını ve zamanlayıcılarını sonlandırır.

Bu API form kullanan metin dönüştürücüler, hesaplamalar, JSON araçları, quizler ve benzeri yerel araçlar içindir. Hazır Vencord eklentileriyle uyumlu değildir. Discord arayüzünü değiştirme, mesaj okuma/gönderme, token, Node.js, dosya, ağ, DOM ve npm paketlerine erişim sunmaz. Kullanıcı yalnızca bu panelde elle yazdığı metni eklentiye verir.

Kod, ayrı kökenli sandbox iframe içindeki Worker'da çalışır. Ağ erişimi CSP ile kapatılır. Yanıt vermeyen veya aşırı çıktı üreten eklenti durdurulur. Bu önlemler işlemci/bellek tüketimine karşı tam güvenlik garantisi değildir; yalnızca güvendiğin kodları çalıştır. Hiçbir eklenti kendiliğinden indirilmez veya güncellenmez.

## Butonlar ve formlar

`api.ui(controls)` eklentinin formunu oluşturur veya değiştirir. En fazla 12 öğe kullanılabilir. Her öğede `id`, `type` ve `label` bulunur. Desteklenen türler: `text`, `textarea`, `checkbox`, `button`. HTML, CSS veya URL verilmez; kontrolleri HyperDC oluşturur.

```js
api.ui([
    { id: "name", type: "text", label: "Adın" },
    { id: "greet", type: "button", label: "Selamla" }
]);
```

Butona basılınca `onAction(api, id, values)` çağrılır. `id` düğmenin kimliği, `values` o eklentinin form alanlarıdır. Metin alanları string, onay kutuları boolean değer verir. Yalnızca Gönder veya eklentinin düğmesine basıldığında veri aktarılır; yazarken aktarılmaz. Form yeniden oluşturulursa girilen değerler sıfırlanabilir. Discord'da seçtiğin metni kendin panelin metin alanına yapıştırabilirsin; eklenti panoyu veya mesajları kendiliğinden okuyamaz.

## Kendi ayarlarını saklama

Etkinleştirme ekranında **kendi ayarlarını saklama** izni ayrıca verilir. İzin verilmezse `api.settings.get()` boş nesne döndürür, `api.settings.set()` reddedilir; form ve metin işleme çalışmaya devam eder.

- `api.settings.get()` bu kod sürümünün kayıtlı ayarlarının bir kopyasını verir.
- `await api.settings.set({ trim: true })` ayar nesnesinin tamamını değiştirir. Başarısız kayıt Promise'i reddeder; eklentide try/catch kullan.
- En fazla 50 alan ve 16.000 karakter JSON desteklenir. Alan değerleri string, sonlu sayı, boolean veya null olabilir. İç içe nesneler ve diziler desteklenmez.
- Saniyede en fazla bir kayıt isteği kabul edilir. Önceki kayıt bitmeden yenisi gönderilmez.
- Kayıtlar dosya adı ve kaynak kodun SHA-256 özetiyle ayrılır. Dosyanın adı veya kodu değişirse eski kayıtlar yeni koda aktarılmaz. Eski dosyayı geri koyarsan kendi kayıtlarına tekrar erişebilir.
- **Kayıtlı ayarları sil** yalnızca incelenen kod sürümünün verisini siler. Eklenti çalışıyorsa tekrar kaydetmemesi için önce durdur.

Kayıtlar bu cihazdaki HyperDC veritabanında tutulur; Discord hesabına eşitlenmez ve şifreli bir kasa değildir. Parola veya token saklama. Eklenti yalnızca kendi ayarlarını okuyabilir; diğer eklentilerin veya HyperDC'nin ayar anahtarlarını seçemez.

Tam çalışan form örneği: [metin-atolyesi.plugin.js](metin-atolyesi.plugin.js). Dosyayı eklenti klasörüne kopyalayıp etkinleştir. Bu örnek yalnızca boşluk temizleme tercihini saklar; girilen metni kaydetmez.

## Güvenlik ve sınırlar

Eklenti kendi panelinin dışına buton ekleyemez, Discord mesajlarına veya mikrofonuna erişemez. Çıktılar düz metindir. Kullanıcı onayı olmadan otomatik başlatma yoktur. Onay, dosyanın incelenmiş içeriğine bağlıdır; inceleme ile başlatma arasında dosya değişirse yükleme reddedilir. Kayıt izni her başlatmada yeniden seçilir.

İzolasyon ve kota kontrolleri kötü niyetli kod için mutlak güvenlik garantisi değildir. Belleği aşırı tüketen kod istemciyi yavaşlatabilir. Güvenmediğin dosyaları çalıştırma.
