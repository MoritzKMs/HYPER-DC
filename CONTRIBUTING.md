# HYPER DC’ye katkıda bulunma

HYPER DC, Vencord tabanlı bir topluluk projesidir. Hata düzeltmeleri, eklentiler, Türkçe çeviriler ve belge iyileştirmeleriyle katkıda bulunabilirsin.

## Başlamadan önce

- [Topluluk kurallarını](CODE_OF_CONDUCT.md) oku.
- Aynı konu için açık bir issue veya pull request olup olmadığını kontrol et.
- Büyük değişiklikler için bu repoda önce bir issue aç ve beklenen davranışı anlat.
- Bu fork ile ilgili talepleri HYPER DC reposuna gönder. Vencord ekibi HYPER DC’ye destek vermekle yükümlü değildir.

## Değişiklik gönderme

1. Repoyu forkla ve değişikliğin için ayrı bir dal aç.
2. [README’deki](README.md#kaynaktan-derleme) kurulum ve derleme adımlarını izle.
3. Değişikliği dar kapsamlı tut; ilgili testleri çalıştır.
4. `main` dalına bir pull request aç. Sorunu, yeni davranışı ve nasıl test ettiğini açıkla.

## Eklenti geliştirme

- Eklentileri `src/plugins` altında geliştir. Mimari için [Vencord geliştirme belgelerinden](https://docs.vencord.dev/) yararlanabilirsin.
- Arayüzde React ve mevcut eklenti API’lerini kullan.
- Ağ isteklerini sınırlı tut; otomatik mesaj, spam veya izinsiz hesap işlemleri ekleme.
- Dosya, mikrofon veya bildirim ayarı değişiklikleri kullanıcı tarafından açıkça başlatılmalı ve durdurulabilmeli.
- Gereksiz bağımlılık ekleme. Dosya yollarını, anahtarları ve kişisel bilgileri repoya koyma.
- HYPER DC’ye ait arayüz metinlerini Türkçe yaz; teknik adları gerektiğinde koru.
- Mevcut lisans ve telif bildirimlerini koru.

## Kontroller

```powershell
node node_modules/typescript/bin/tsc --noEmit
node tests/hyperQuiet.test.mjs
node tests/hyperDeck.test.mjs
node scripts/build/build.mjs --standalone --disable-updater
```

Değişen dosyalarda ESLint ve Stylelint kontrollerini de çalıştır. Gerçek Discord oturumunda yapılmayan testleri yapılmış gibi belirtme.
